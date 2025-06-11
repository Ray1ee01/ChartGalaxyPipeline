/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_06",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, 100]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text_color", "background_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "yes",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const configVariables = data.variables || {};
    const typographyOptions = data.typography || {};
    const colorOptions = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if needed
    const imageOptions = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;

    if (!xFieldName || !yFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x field (role='x')");
        if (!yFieldName) missingFields.push("y field (role='y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldUnit = xFieldConfig && xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const yFieldUnit = yFieldConfig && yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" }, // Not used for main title
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const defaultColors = {
        text_color: "#0f223b",
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "#FFFFFF"
    };

    const fillStyle = {
        typography: {
            labelFontFamily: (typographyOptions.label && typographyOptions.label.font_family) || defaultTypography.label.font_family,
            labelFontSize: (typographyOptions.label && typographyOptions.label.font_size) || defaultTypography.label.font_size,
            labelFontWeight: (typographyOptions.label && typographyOptions.label.font_weight) || defaultTypography.label.font_weight,
        },
        textColor: colorOptions.text_color || defaultColors.text_color,
        chartBackground: colorOptions.background_color || defaultColors.background_color,
        barPrimaryColor: (colorOptions.other && colorOptions.other.primary) || defaultColors.other.primary,
        get barDarkerPrimaryColor() {
            return d3.rgb(this.barPrimaryColor).darker(0.7).toString();
        }
    };

    function estimateTextWidth(text, fontProps = {}) {
        const {
            fontFamily = fillStyle.typography.labelFontFamily,
            fontSize = fillStyle.typography.labelFontSize,
            fontWeight = fillStyle.typography.labelFontWeight
        } = fontProps;

        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but per spec, do not append to DOM. For simple cases, this might suffice.
        // If not, a hidden live SVG element might be needed.
        // However, the prompt explicitly says "MUST NOT be appended to the document DOM".
        // So we rely on the behavior of getBBox on non-rendered elements.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-rendered elements
            return text.length * (parseFloat(fontSize) * 0.6); // Rough estimate
        }
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = configVariables.width || 800;
    const containerHeight = configVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 50 }; // Adjusted left margin for potentially longer Y-axis labels
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map(d => ({
        category: d[xFieldName],
        value: +d[yFieldName]
    }));

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 0]) // Ensure domain starts at 0, handle empty data
        .range([innerHeight, 0])
        .nice();

    const colorScale = (d, i) => {
        return i === 0 ? fillStyle.barDarkerPrimaryColor : fillStyle.barPrimaryColor;
    };

    // X-axis label rotation logic
    let rotateXLabels = false;
    const maxXLabelWidth = xScale.bandwidth() * 1.03; // Allow slight overflow
    if (processedData.length > 0) {
        let requiresRotation = false;
        for (const d of processedData) {
            const xLabelText = String(d.category);
            const currentWidth = estimateTextWidth(xLabelText, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            if (currentWidth > maxXLabelWidth) {
                requiresRotation = true;
                break;
            }
        }
        if (requiresRotation) {
            // Check if rotation helps enough
            // Estimate width of rotated label (height of bounding box after rotation)
            // For -45deg, new "effective width" is roughly (height + width)/sqrt(2)
            // This is complex, so use a simpler heuristic: if any label is too wide, rotate.
            rotateXLabels = true;
        }
    }


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGenerator = d3.axisBottom(xScale)
        .tickSize(0)
        .tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxisGenerator);

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", rotateXLabels ? "end" : "middle")
        .attr("dx", rotateXLabels ? "-0.8em" : null)
        .attr("dy", rotateXLabels ? "0.15em" : null)
        .attr("transform", rotateXLabels ? "rotate(-45)" : "rotate(0)");
    
    xAxisGroup.select(".domain").style("stroke", fillStyle.textColor);


    const yAxisGenerator = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => formatValue(d) + (yFieldUnit ? ` ${yFieldUnit}` : ''))
        .tickSize(0)
        .tickPadding(10);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxisGenerator);

    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    yAxisGroup.select(".domain").remove(); // Remove Y-axis line as per original behavior

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-path-mark")
        .data(processedData)
        .enter()
        .append("path")
        .attr("class", "mark bar-path-mark")
        .attr("d", d => {
            const x = xScale(d.category);
            const barVal = d.value >= 0 ? d.value : 0; // Ensure value is not negative for height calculation
            const y = yScale(barVal);
            const barWidth = xScale.bandwidth();
            const barHeight = innerHeight - yScale(barVal);
            const midX = x + barWidth / 2;

            if (barHeight <= 0) return ""; // Avoid rendering zero or negative height bars

            return `M ${x} ${innerHeight}
                    L ${x + barWidth} ${innerHeight}
                    C ${x + barWidth * 0.55} ${innerHeight}, ${midX + barWidth * 0.05} ${y + barHeight * 0.5}, ${midX} ${y}
                    C ${midX - barWidth * 0.05} ${y + barHeight * 0.5}, ${x + barWidth * 0.45} ${innerHeight}, ${x} ${innerHeight}
                    Z`;
        })
        .attr("fill", (d, i) => colorScale(d, i));

    const dataLabelElements = mainChartGroup.selectAll(".data-value-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label data-value-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => {
             const barVal = d.value >= 0 ? d.value : 0;
             return yScale(barVal) - 5;
        })
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d.value) + (yFieldUnit ? ` ${yFieldUnit}` : ''));

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
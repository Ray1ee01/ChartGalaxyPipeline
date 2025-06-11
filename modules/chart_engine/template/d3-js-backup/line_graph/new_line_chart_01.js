/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bar Chart",
  "chart_name": "vertical_bar_chart_new_01",
  "is_composite": true,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[4, 12], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "none",
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
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed in data.colors_dark
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container upfront

    const xFieldColumn = dataColumns.find(col => col.role === 'x');
    const yFieldColumn = dataColumns.find(col => col.role === 'y');

    if (!xFieldColumn || !xFieldColumn.name || !yFieldColumn || !yFieldColumn.name) {
        const missing = [];
        if (!xFieldColumn || !xFieldColumn.name) missing.push("x-field configuration (from data.data.columns with role 'x')");
        if (!yFieldColumn || !yFieldColumn.name) missing.push("y-field configuration (from data.data.columns with role 'y')");
        
        const errorMessage = `Critical chart config missing: [${missing.join(', ')}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("padding", "10px")
                .html(errorMessage);
        }
        return null;
    }

    const categoryFieldName = xFieldColumn.name;
    const valueFieldName = yFieldColumn.name;
    const valueFieldUnit = yFieldColumn.unit || '';

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colorsConfig.text_color || '#0f223b',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        primaryBarColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#1f77b4',
        gridLineColor: '#e0e0e0', // Default from original
        dataPointCircleFill: '#FFFFFF',
        typography: {
            title: {
                fontFamily: (typographyConfig.title && typographyConfig.title.font_family) ? typographyConfig.title.font_family : 'Arial, sans-serif',
                fontSize: (typographyConfig.title && typographyConfig.title.font_size) ? typographyConfig.title.font_size : '16px',
                fontWeight: (typographyConfig.title && typographyConfig.title.font_weight) ? typographyConfig.title.font_weight : 'bold',
            },
            label: {
                fontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
                fontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
                fontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            },
            annotation: {
                fontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
                fontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
                fontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
            }
        }
    };
    
    // Helper to estimate text width (in-memory SVG)
    function estimateTextWidth(text, fontProps) {
        if (!text || text.length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: getBBox on un-appended elements can be inconsistent. Directive requires no DOM append.
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("Failed to measure text width with in-memory SVG, using fallback.", e);
            const fontSizeNumeric = parseFloat(fontProps.fontSize) || 12;
            width = text.length * fontSizeNumeric * 0.6; // Rough fallback
        }
        return width;
    }

    // Helper function to wrap text within a given width
    function wrapText(textSelection, maxWidth, baseLineHeightRatio, fontStyles) {
        textSelection.each(function() {
            const textD3 = d3.select(this);
            const originalText = textD3.text();
            const words = originalText.split(/\s+/).reverse();
            
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textD3.attr("x") || 0;
            const y = textD3.attr("y") || 0;
            const initialDy = 0; // Assuming dy is applied from baseline of text element itself

            textD3.text(null);

            const fontSizeNumeric = parseFloat(fontStyles.fontSize);
            const lineHeightPixels = fontSizeNumeric * baseLineHeightRatio;

            let tspan = textD3.append("tspan")
                .attr("x", x)
                .attr("y", y) 
                .attr("dy", `${initialDy}px`);

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (estimateTextWidth(tspan.text(), fontStyles) > maxWidth && line.length > 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    lineNumber++;
                    tspan = textD3.append("tspan")
                        .attr("x", x)
                        .attr("dy", `${lineHeightPixels}px`)
                        .text(word);
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
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 30, bottom: 80, left: 50 }; // Standardized margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [valueFieldName]: +d[valueFieldName] // Ensure value is numeric
    }));

    const categories = chartDataArray.map(d => d[categoryFieldName]);
    const yMax = d3.max(chartDataArray, d => d[valueFieldName]) || 0;

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, yMax * 1.2]) // Add 20% padding at the top for labels
        .range([innerHeight, 0])
        .nice();


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Y-axis Gridlines
    const yAxisGrid = d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(-innerWidth)
        .tickFormat("");

    mainChartGroup.append("g")
        .attr("class", "gridline y-gridline")
        .call(yAxisGrid)
        .selectAll("line")
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-dasharray", "2,2");
    mainChartGroup.selectAll(".y-gridline .domain").remove(); // Remove axis line, keep only grid

    // X-axis Labels
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis-labels-group")
        .attr("transform", `translate(0, ${innerHeight})`);

    const xLabels = xAxisLabelsGroup.selectAll(".x-axis-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label x-axis-label")
        .attr("x", d => xScale(d[categoryFieldName]) + xScale.bandwidth() / 2)
        .attr("y", chartMargins.bottom / 3) // Position within bottom margin
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "hanging")
        .style("font-family", fillStyle.typography.label.fontFamily)
        .style("font-size", fillStyle.typography.label.fontSize)
        .style("font-weight", fillStyle.typography.label.fontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => d[categoryFieldName]);
    
    // Apply text wrapping to x-axis labels
    wrapText(xLabels, xScale.bandwidth() * 0.95, 1.1, fillStyle.typography.label);


    // Y-axis Unit Label
    if (valueFieldUnit) {
        mainChartGroup.append("text")
            .attr("class", "label y-axis-unit")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerHeight / 2)
            .attr("y", -chartMargins.left + 15) // Position in left margin
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.label.fontFamily)
            .style("font-size", fillStyle.typography.label.fontSize) // Using label font size
            .style("font-weight", fillStyle.typography.label.fontWeight)
            .attr("fill", fillStyle.textColor)
            .text(valueFieldUnit);
    }

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    // Bars
    mainChartGroup.selectAll(".bar")
        .data(chartDataArray)
        .enter()
        .append("rect")
        .attr("class", "mark bar")
        .attr("x", d => xScale(d[categoryFieldName]))
        .attr("y", d => yScale(d[valueFieldName]))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d[valueFieldName]))
        .attr("fill", fillStyle.primaryBarColor);

    // Connecting Line
    const lineGenerator = d3.line()
        .x(d => xScale(d[categoryFieldName]) + xScale.bandwidth() / 2)
        .y(d => yScale(d[valueFieldName]))
        .curve(d3.curveLinear);

    mainChartGroup.append("path")
        .datum(chartDataArray)
        .attr("class", "mark line")
        .attr("fill", "none")
        .attr("stroke", fillStyle.primaryBarColor)
        .attr("stroke-width", 2)
        .attr("d", lineGenerator);

    // Data Point Circles
    const circleRadius = 6; // Slightly smaller than original 8
    mainChartGroup.selectAll(".data-point-circle")
        .data(chartDataArray)
        .enter()
        .append("circle")
        .attr("class", "mark data-point-circle")
        .attr("cx", d => xScale(d[categoryFieldName]) + xScale.bandwidth() / 2)
        .attr("cy", d => yScale(d[valueFieldName]))
        .attr("r", circleRadius)
        .attr("fill", fillStyle.dataPointCircleFill)
        .attr("stroke", fillStyle.primaryBarColor)
        .attr("stroke-width", 2);

    // Data Value Labels
    mainChartGroup.selectAll(".value-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label value-label")
        .attr("x", d => xScale(d[categoryFieldName]) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d[valueFieldName]) - circleRadius - 5) // Position above circle
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "alphabetic") // To ensure consistent placement above point
        .style("font-family", fillStyle.typography.annotation.fontFamily)
        .style("font-size", fillStyle.typography.annotation.fontSize)
        .style("font-weight", fillStyle.typography.annotation.fontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => `${d[valueFieldName]}${valueFieldUnit}`);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Icons below bars (at the bottom of the chart plot area)
    const iconSize = Math.min(xScale.bandwidth(), chartMargins.bottom / 2 * 0.8); // Ensure icons fit
    const iconsGroup = mainChartGroup.append("g")
        .attr("class", "icons-group");

    iconsGroup.selectAll(".icon-image")
        .data(chartDataArray)
        .enter()
        .append("image")
        .attr("class", "icon x-axis-icon")
        .attr("x", d => xScale(d[categoryFieldName]) + (xScale.bandwidth() - iconSize) / 2)
        .attr("y", innerHeight - iconSize - 5) // Positioned at the bottom of the chart area, above x-axis labels
        .attr("width", iconSize)
        .attr("height", iconSize)
        .attr("xlink:href", d => {
            const categoryValue = d[categoryFieldName];
            if (imagesConfig.field && imagesConfig.field[categoryValue]) {
                return imagesConfig.field[categoryValue];
            }
            // Fallback to a generic icon if one is provided in images.other.primary
            if (imagesConfig.other && imagesConfig.other.primary) {
                 // return imagesConfig.other.primary; // Uncomment if generic fallback is desired
            }
            return null; // No image if specific not found and no generic fallback
        })
        .each(function(d) { // Remove image element if href is null to prevent broken image icons
            if (!d3.select(this).attr("xlink:href")) {
                d3.select(this).remove();
            }
        });


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
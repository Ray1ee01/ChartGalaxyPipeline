/* REQUIREMENTS_BEGIN
{
  "chart_type": "Extended Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_18_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text", "background"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Assuming light theme, or use data.colors_dark for dark
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const getFieldConfig = (role) => dataColumns.find(col => col.role === role);

    const xFieldConfig = getFieldConfig(xFieldRole);
    const yFieldConfig = getFieldConfig(yFieldRole);

    const categoryFieldName = xFieldConfig?.name;
    const valueFieldName = yFieldConfig?.name;
    
    const yFieldUnit = (yFieldConfig?.unit && yFieldConfig.unit !== "none") ? ` ${yFieldConfig.unit}` : "";

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push(`role '${xFieldRole}' (category)`);
        if (!valueFieldName) missingFields.push(`role '${yFieldRole}' (value)`);
        
        const errorMessage = `Critical chart config missing: Field name(s) for ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: {
                font_family: typographyInput.title?.font_family || "Arial, sans-serif",
                font_size: typographyInput.title?.font_size || "16px",
                font_weight: typographyInput.title?.font_weight || "bold",
            },
            label: { // For axis labels, bottom text
                font_family: typographyInput.label?.font_family || "Arial, sans-serif",
                font_size: typographyInput.label?.font_size || "12px",
                font_weight: typographyInput.label?.font_weight || "normal",
            },
            annotation: { // For bar top value labels
                font_family: typographyInput.annotation?.font_family || "Arial, sans-serif",
                font_size: typographyInput.annotation?.font_size || "10px",
                font_weight: typographyInput.annotation?.font_weight || "normal",
            }
        },
        textColor: colorsInput.text_color || "#333333",
        textOnPrimaryColor: "#FFFFFF", // Assuming primary is dark enough for white text
        chartBackground: colorsInput.background_color || "#F0F0F0", // Default from original
        barPrimary: colorsInput.other?.primary || "#D32F2F", // Default from original
        axisLineColor: colorsInput.text_color || "#CCCCCC", // For minimal axes if lines were visible
    };
    fillStyle.barFirstHighlight = d3.color(fillStyle.barPrimary).darker(0.7).toString();

    function estimateTextWidth(text, fontProps = fillStyle.typography.label) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontProps.font_family);
        textEl.setAttribute('font-size', fontProps.font_size);
        textEl.setAttribute('font-weight', fontProps.font_weight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Document append/remove is not strictly necessary for getBBox if styles are applied directly
        // but some browsers might be more consistent if it's briefly in a document fragment or similar.
        // For this implementation, direct measurement without DOM append is preferred.
        // document.body.appendChild(svg); // Not appending to DOM
        const width = textEl.getBBox().width;
        // document.body.removeChild(svg); // Not appending to DOM
        return width;
    }
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 50, // Increased to accommodate top labels
        right: 30,
        bottom: 180, // Increased to accommodate extended part + labels + images
        left: 60  // Increased to accommodate y-axis labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName]
    }));

    const extensionHeight = 100; // Fixed perspective extension height
    const midIndex = Math.floor(chartDataArray.length / 2);
    const offsetStep = 50; // Fixed offset step for perspective

    chartDataArray.forEach((d, i) => {
        d.offset = (i - midIndex) * offsetStep;
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => d.value) || 10]) // Ensure domain is at least 0-10
        .range([innerHeight, 0])
        .nice();

    const colorScaleFn = (d, i) => {
        return i === 0 ? fillStyle.barFirstHighlight : fillStyle.barPrimary;
    };

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10))
        .call(g => g.select(".domain").remove());
    
    xAxisGroup.selectAll("text")
        .attr("class", "label x-axis-label")
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "middle"); // Default, can be adjusted if needed

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d + yFieldUnit).tickSize(0).tickPadding(10))
        .call(g => g.select(".domain").remove());

    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .style("fill", fillStyle.textColor);
    
    yAxisGroup.selectAll("line").remove(); // Remove tick lines explicitly if any remain

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barWidth = xScale.bandwidth();

    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "mark bar-group")
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    // Main bars
    barGroups.append("rect")
        .attr("class", "mark main-bar")
        .attr("x", 0)
        .attr("y", d => yScale(d.value))
        .attr("width", barWidth)
        .attr("height", d => Math.max(0, innerHeight - yScale(d.value))) // Ensure non-negative height
        .attr("fill", (d, i) => colorScaleFn(d, i));

    // Extended paths (perspective)
    barGroups.append("path")
        .attr("class", "mark extended-path")
        .attr("d", d => {
            const topLeftX = 0;
            const topLeftY = innerHeight;
            const topRightX = barWidth;
            const topRightY = innerHeight;
            
            const padding = xScale.padding();
            const totalBandwidthWithPadding = xScale.bandwidth() / (1 - padding); // Effective width if padding was 0
            const bottomWidth = totalBandwidthWithPadding + d.offset * (d.offset > 0 ? 1 : -1) - (totalBandwidthWithPadding * padding) ; // Simplified approximation
            
            const bottomRightX = topRightX + (bottomWidth - barWidth) / 2 + d.offset;
            const bottomRightY = innerHeight + extensionHeight;
            const bottomLeftX = topLeftX - (bottomWidth - barWidth) / 2 + d.offset;
            const bottomLeftY = innerHeight + extensionHeight;

            return `M ${topLeftX},${topLeftY} L ${topRightX},${topRightY} L ${bottomRightX},${bottomRightY} L ${bottomLeftX},${bottomLeftY} Z`;
        })
        .attr("fill", (d, i) => colorScaleFn(d, i))
        .attr("opacity", 0.8);

    // Bottom rectangles
    const bottomRectHeight = 50;
    barGroups.append("rect")
        .attr("class", "mark bottom-rect")
        .attr("x", d => {
            const padding = xScale.padding();
            const totalBandwidthWithPadding = xScale.bandwidth() / (1 - padding);
            const bottomWidth = totalBandwidthWithPadding + d.offset * (d.offset > 0 ? 1 : -1) - (totalBandwidthWithPadding * padding);
            return -((bottomWidth - barWidth) / 2) + d.offset;
        })
        .attr("y", innerHeight + extensionHeight)
        .attr("width", d => {
            const padding = xScale.padding();
            const totalBandwidthWithPadding = xScale.bandwidth() / (1 - padding);
            return totalBandwidthWithPadding + d.offset * (d.offset > 0 ? 1 : -1) - (totalBandwidthWithPadding * padding);
        })
        .attr("height", bottomRectHeight)
        .attr("fill", (d, i) => colorScaleFn(d, i))
        .attr("opacity", 0.9);

    // Bottom images
    const imageSizeFactor = 1.0; // Adjust if images need to be smaller/larger than calculated width
    barGroups.append("image")
        .attr("class", "image bottom-image")
        .attr("xlink:href", d => {
            const imageSrc = imagesInput.field && imagesInput.field[d.category] 
                ? imagesInput.field[d.category]
                : (imagesInput.other && imagesInput.other.primary ? imagesInput.other.primary : null);
            return imageSrc;
        })
        .attr("x", d => {
            const padding = xScale.padding();
            const totalBandwidthWithPadding = xScale.bandwidth() / (1 - padding);
            const imageWidth = (totalBandwidthWithPadding + d.offset * (d.offset > 0 ? 1 : -1) - (totalBandwidthWithPadding * padding)) * imageSizeFactor;
            return -((imageWidth - barWidth) / 2) + d.offset + (imageWidth * (1-imageSizeFactor))/2 ;
        })
        .attr("y", d => {
            const padding = xScale.padding();
            const totalBandwidthWithPadding = xScale.bandwidth() / (1 - padding);
            const imageHeight = (totalBandwidthWithPadding + d.offset * (d.offset > 0 ? 1 : -1) - (totalBandwidthWithPadding * padding)) * imageSizeFactor;
            return innerHeight + extensionHeight - imageHeight;
        })
        .attr("width", d => {
            const padding = xScale.padding();
            const totalBandwidthWithPadding = xScale.bandwidth() / (1 - padding);
            return (totalBandwidthWithPadding + d.offset * (d.offset > 0 ? 1 : -1) - (totalBandwidthWithPadding * padding)) * imageSizeFactor;
        })
        .attr("height", d => { // Assuming square images based on original logic
            const padding = xScale.padding();
            const totalBandwidthWithPadding = xScale.bandwidth() / (1 - padding);
            return (totalBandwidthWithPadding + d.offset * (d.offset > 0 ? 1 : -1) - (totalBandwidthWithPadding * padding)) * imageSizeFactor;
        })
        .each(function() { // Hide if no href
            if (!d3.select(this).attr("xlink:href")) {
                d3.select(this).remove();
            }
        });


    // Bottom text (category labels on the extended base)
    barGroups.append("text")
        .attr("class", "label bottom-text")
        .attr("x", d => { // Centered on the bottom rectangle
            const padding = xScale.padding();
            const totalBandwidthWithPadding = xScale.bandwidth() / (1 - padding);
            const bottomWidth = totalBandwidthWithPadding + d.offset * (d.offset > 0 ? 1 : -1) - (totalBandwidthWithPadding * padding);
            return -((bottomWidth - barWidth) / 2) + d.offset + (bottomWidth / 2);
        })
        .attr("y", innerHeight + extensionHeight + bottomRectHeight / 2) // Vertically centered in bottom-rect
        .style("fill", fillStyle.textOnPrimaryColor)
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .each(function(d) {
            const textElement = d3.select(this);
            const textContent = String(d.category);
            
            const padding = xScale.padding();
            const totalBandwidthWithPadding = xScale.bandwidth() / (1 - padding);
            const availableWidth = (totalBandwidthWithPadding + d.offset * (d.offset > 0 ? 1 : -1) - (totalBandwidthWithPadding * padding)) - 10; // 5px padding each side

            let fontSize = parseFloat(fillStyle.typography.label.font_size);
            textElement.style("font-size", `${fontSize}px`);
            let currentTextWidth = estimateTextWidth(textContent, { ...fillStyle.typography.label, font_size: `${fontSize}px` });

            while (currentTextWidth > availableWidth && fontSize > 8) {
                fontSize -= 1;
                textElement.style("font-size", `${fontSize}px`);
                currentTextWidth = estimateTextWidth(textContent, { ...fillStyle.typography.label, font_size: `${fontSize}px` });
            }
            textElement.text(textContent);
            if (currentTextWidth > availableWidth) { // If still too wide, truncate (simple)
                 let shortText = textContent;
                 while(estimateTextWidth(shortText + "...", {...fillStyle.typography.label, font_size: `${fontSize}px`}) > availableWidth && shortText.length > 1){
                    shortText = shortText.slice(0, -1);
                 }
                 textElement.text(shortText.length > 1 ? shortText + "..." : "");
            }
        });

    // Bar top value labels
    const valueLabelBgHeight = 20;
    const valueLabelBgWidth = 40; // Fixed width, might need adjustment or dynamic sizing
    barGroups.append("rect")
        .attr("class", "mark value-bg")
        .attr("x", barWidth / 2 - valueLabelBgWidth / 2)
        .attr("y", d => yScale(d.value) - valueLabelBgHeight - 5) // 5px above bar
        .attr("width", valueLabelBgWidth)
        .attr("height", valueLabelBgHeight)
        .attr("fill", (d,i) => colorScaleFn(d,i))
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("display", d => (innerHeight - yScale(d.value) < valueLabelBgHeight + 5) ? "none" : "block"); // Hide if bar too short


    barGroups.append("text")
        .attr("class", "value bar-top-label")
        .attr("x", barWidth / 2)
        .attr("y", d => yScale(d.value) - valueLabelBgHeight / 2 - 5) // Vertically centered in bg
        .style("fill", fillStyle.textOnPrimaryColor)
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotation.font_family)
        .style("font-size", fillStyle.typography.annotation.font_size)
        .style("font-weight", fillStyle.typography.annotation.font_weight)
        .text(d => `${d.value}${yFieldUnit}`)
        .attr("display", d => (innerHeight - yScale(d.value) < valueLabelBgHeight + 5) ? "none" : "block"); // Hide if bar too short


    // Block 9: Optional Enhancements & Post-Processing
    // Removed gradient lines and intersection gradient as per requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
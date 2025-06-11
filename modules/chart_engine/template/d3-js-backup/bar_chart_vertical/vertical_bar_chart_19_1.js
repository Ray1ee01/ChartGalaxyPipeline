/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_19_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 10], [0, 100]],
  "required_fields_icons": [],
  "required_other_icons": ["primary"],
  "required_fields_colors": [],
  "required_other_colors": ["text_color", "background_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const rawTypography = data.typography || {};
    const typography = {
        title: {
            font_family: (rawTypography.title && rawTypography.title.font_family) || "Arial, sans-serif",
            font_size: (rawTypography.title && rawTypography.title.font_size) || "16px",
            font_weight: (rawTypography.title && rawTypography.title.font_weight) || "bold",
        },
        label: {
            font_family: (rawTypography.label && rawTypography.label.font_family) || "Arial, sans-serif",
            font_size: (rawTypography.label && rawTypography.label.font_size) || "12px",
            font_weight: (rawTypography.label && rawTypography.label.font_weight) || "normal",
        },
        annotation: {
            font_family: (rawTypography.annotation && rawTypography.annotation.font_family) || "Arial, sans-serif",
            font_size: (rawTypography.annotation && rawTypography.annotation.font_size) || "10px",
            font_weight: (rawTypography.annotation && rawTypography.annotation.font_weight) || "normal",
        }
    };

    const rawColors = data.colors || {};
    const colors = {
        text_color: rawColors.text_color || "#333333",
        background_color: rawColors.background_color || "#FFFFFF",
        other: rawColors.other || {},
        field: rawColors.field || {},
        available_colors: rawColors.available_colors || d3.schemeCategory10
    };

    const rawImages = data.images || {};
    const images = {
        other: rawImages.other || {},
        field: rawImages.field || {}
    };

    const xFieldDefinition = dataColumns.find(col => col.role === "x");
    const yFieldDefinition = dataColumns.find(col => col.role === "y");

    const xFieldName = xFieldDefinition ? xFieldDefinition.name : undefined;
    const yFieldName = yFieldDefinition ? yFieldDefinition.name : undefined;

    let xFieldUnit = (xFieldDefinition && xFieldDefinition.unit !== "none") ? xFieldDefinition.unit : "";
    let yFieldUnit = (yFieldDefinition && yFieldDefinition.unit !== "none") ? yFieldDefinition.unit : "";

    if (!xFieldName || !yFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push("x field ('role': 'x')");
        if (!yFieldName) missingFields.push("y field ('role': 'y')");
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')} from data.data.columns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }
    
    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color,
        chartBackground: colors.background_color,
        primaryBarImageURL: images.other && images.other.primary ? images.other.primary : null,
        typography: {
            labelFontFamily: typography.label.font_family,
            labelFontSize: typography.label.font_size,
            labelFontWeight: typography.label.font_weight,
            annotationFontFamily: typography.annotation.font_family,
            annotationFontSize: typography.annotation.font_size,
            annotationFontWeight: typography.annotation.font_weight,
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but per spec, must not append to DOM. This might be less accurate.
        // For robustness in a real scenario, a hidden live SVG might be used.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            return text.length * (parseInt(fontSize, 10) || 12) * 0.6; 
        }
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 40 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

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
        .domain([0, d3.max(processedData, d => d.value) || 0])
        .range([innerHeight, 0])
        .nice();

    let minXLabelRatio = 1.0;
    const maxXLabelWidth = xScale.bandwidth() * 1.03;

    xScale.domain().forEach(categoryText => {
        const text = String(categoryText) + (xFieldUnit ? ` ${xFieldUnit}` : '');
        const currentWidth = estimateTextWidth(text, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (currentWidth > maxXLabelWidth) {
            minXLabelRatio = Math.min(minXLabelRatio, maxXLabelWidth / currentWidth);
        }
    });
    
    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickFormat(d => d + (xFieldUnit ? ` ${xFieldUnit}` : '')))
        .call(g => g.select(".domain").remove());
    
    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", minXLabelRatio < 1.0 ? "end" : "middle")
        .attr("transform", minXLabelRatio < 1.0 ? "rotate(-45)" : "rotate(0)");

    // Y-axis is not rendered visually as per original logic and simplification (tickSize(0), domain removed, text removed)

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    if (!fillStyle.primaryBarImageURL) {
        console.warn("Primary bar image URL is missing (images.other.primary). Bars will not be rendered.");
    }

    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "mark image-stack-group")
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    if (fillStyle.primaryBarImageURL) {
        const imgAspectRatio = 1; // Assuming square images or aspect ratio handled by image itself

        barGroups.each(function(d) {
            const barItem = d3.select(this);
            const barHeight = innerHeight - yScale(d.value);
            if (barHeight <= 0) return; // Skip if bar height is zero or negative

            const barWidth = xScale.bandwidth();
            
            const imgWidth = barWidth;
            const imgHeight = imgWidth / imgAspectRatio;
            
            // These factors (0.353, 0.7) are from the original code to preserve visual output
            const effectiveImageHeightFactor = 0.353;
            const initialImageOffsetFactor = 0.7;

            const numImages = Math.ceil(barHeight / (imgHeight * effectiveImageHeightFactor));
            
            for (let i = 0; i < numImages; i++) {
                barItem.append("image")
                    .attr("class", "image image-stack-item")
                    .attr("xlink:href", fillStyle.primaryBarImageURL)
                    .attr("x", 0)
                    .attr("y", innerHeight - (imgHeight * initialImageOffsetFactor) - (i + 1) * (imgHeight * effectiveImageHeightFactor))
                    .attr("width", imgWidth)
                    .attr("height", imgHeight);
            }
        });
    }
    
    mainChartGroup.selectAll(".data-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label data-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => {
            const barHeight = innerHeight - yScale(d.value);
            if (barHeight <= 0 && fillStyle.primaryBarImageURL) return yScale(d.value) - 10; // Position above baseline if no bar
            if (!fillStyle.primaryBarImageURL) return yScale(d.value) -10; // If no images, position above where bar top would be

            const imgWidth = xScale.bandwidth();
            const imgAspectRatio = 1;
            const imgHeight = imgWidth / imgAspectRatio;
            const effectiveImageHeightFactor = 0.353;
            const numImages = Math.ceil(barHeight / (imgHeight * effectiveImageHeightFactor));
            const stackHeight = numImages * imgHeight * effectiveImageHeightFactor;
            
            return innerHeight - stackHeight - (imgHeight * 0.7) -10; // Adjusted to be above the visual top of stack
        })
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d.value + (yFieldUnit ? ` ${yFieldUnit}` : ''));

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pictorial Percentage Bar Chart",
  "chart_name": "vertical_pictorial_percentage_bar_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 10], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "dark",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors_dark || data.colors || {}; // Prefer dark theme if available
    const inputImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldColumn = dataColumns.find(col => col.role === "x");
    const yFieldColumn = dataColumns.find(col => col.role === "y");

    if (!xFieldColumn || !yFieldColumn) {
        const missing = [];
        if (!xFieldColumn) missing.push("x field");
        if (!yFieldColumn) missing.push("y field");
        const errorMessage = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    const categoryFieldName = xFieldColumn.name;
    const valueFieldName = yFieldColumn.name;
    // const categoryFieldUnit = xFieldColumn.unit !== "none" ? xFieldColumn.unit : ""; // Not used in this chart
    // const valueFieldUnit = yFieldColumn.unit !== "none" ? yFieldColumn.unit : ""; // Not used in this chart

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (inputTypography.label && inputTypography.label.font_family) ? inputTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (inputTypography.label && inputTypography.label.font_size) ? inputTypography.label.font_size : '16px',
            labelFontWeight: (inputTypography.label && inputTypography.label.font_weight) ? inputTypography.label.font_weight : '500',
            // Add other typography tokens if needed, e.g., for annotations or titles (though titles are removed)
        },
        textColor: inputColors.text_color || '#FFFFFF', // Default to white for dark background
        primaryFillColor: (inputColors.other && inputColors.other.primary) ? inputColors.other.primary : '#4CAF50',
        chartBackgroundColor: inputColors.background_color || '#1E1E1E', // Default dark background
        bottleImageOpacity: 0.15, // For the background bottle
    };

    // In-memory text measurement utility
    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = 'auto';
        svg.style.height = 'auto';
        // No need to append to DOM for getBBox if styled directly on text element

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        if (fontProps) {
            if (fontProps.fontFamily) textElement.style.fontFamily = fontProps.fontFamily;
            if (fontProps.fontSize) textElement.style.fontSize = fontProps.fontSize;
            if (fontProps.fontWeight) textElement.style.fontWeight = fontProps.fontWeight;
        }
        svg.appendChild(textElement);
        // Temporarily append to body to ensure styles are computed for getBBox, then remove
        document.body.appendChild(svg);
        const width = textElement.getBBox().width;
        document.body.removeChild(svg);
        return width;
    }
    
    // SVG to Base64 utility
    function svgToBase64(svgString) {
        const cleanSvg = svgString.replace(/\s+/g, ' ').trim();
        const encoded = encodeURIComponent(cleanSvg);
        return 'data:image/svg+xml;base64,' + btoa(unescape(encoded));
    }

    const bottleImageSVGString = `<svg viewBox="0 0 200 500" xmlns="http://www.w3.org/2000/svg"><path d="M60,280 L60,450 Q100,480 140,450 L140,280 Z" fill="${fillStyle.primaryFillColor}"/><path d="M60,230 L60,280 L140,280 L140,230 Z" fill="#64B5F6"/><circle cx="100" cy="255" r="25" fill="#64B5F6"/><path d="M75,50 Q100,40 125,50 L125,70 Q100,80 75,70 Z" fill="#90CAF9"/><path d="M80,70 L60,230 L140,230 L120,70 Z" fill="#90CAF9"/><path d="M80,70 Q100,60 120,70 L120,70 Q100,80 80,70 Z" fill="#90CAF9"/></svg>`;
    // Note: Removed gradient and filter from bottle SVG string to comply with "solid colors only" and simplify.
    // If the original SVG's complex appearance is critical, this part might need adjustment or clarification.
    // For now, using a simplified bottle. The fill of the main path is now fillStyle.primaryFillColor.
    // The other parts of the bottle SVG use hardcoded colors. These could also be tokenized if needed.
    fillStyle.bottleImageURL = svgToBase64(bottleImageSVGString);

    // Text wrapping utility
    function wrapText(textSelection, textContent, maxWidth, lineHeightEm = 1.1, verticalAlign = 'middle') {
        textSelection.each(function() {
            const textElement = d3.select(this);
            const words = textContent.toString().split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textElement.attr("x");
            const y = textElement.attr("y"); // y is the baseline of the first line for 'top', or middle for 'middle'
            
            textElement.text(null); // Clear existing text
            let tspan = textElement.append("tspan").attr("x", x); // dy will be set later

            let lines = [];

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                    line.pop();
                    lines.push(line.join(" "));
                    line = [word];
                    tspan.text(line.join(" ")); // Start new line with current word
                }
            }
            lines.push(line.join(" ")); // Add the last line

            textElement.text(null); // Clear again before adding final tspans

            const numLines = lines.length;
            let startDy;
            if (verticalAlign === 'middle') {
                startDy = -((numLines - 1) / 2) * lineHeightEm + "em";
            } else if (verticalAlign === 'bottom') {
                 startDy = -(numLines - 1) * lineHeightEm + "em";
            } else { // top alignment
                startDy = "0em"; // Or slightly adjust if y is not meant for baseline
            }
            
            lines.forEach((lineText, i) => {
                textElement.append("tspan")
                    .attr("x", x)
                    .attr("dy", i === 0 ? startDy : lineHeightEm + "em")
                    .text(lineText);
            });
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
        .style("background-color", fillStyle.chartBackgroundColor)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const chartMargins = { top: 60, right: 30, bottom: 80, left: 30 }; // Adjusted top margin

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Bottle SVG aspect ratio (from its viewBox: 200w / 500h)
    const bottleSVGViewBox = [0, 0, 200, 500]; // width, height from viewBox
    const bottleSVGAspectRatio = bottleSVGViewBox[3] / bottleSVGViewBox[2];


    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = [...rawChartData].sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d[categoryFieldName]))
        .range([0, innerWidth])
        .padding(0.2);

    const maxValue = d3.max(chartDataArray, d => d[valueFieldName]);
    // yScale is not strictly needed for bottle height if all bottles are same visual height
    // but useful for percentage calculation.
    const yScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue * 1.1 : 1]) // Ensure domain is not [0,0]
        .range([innerHeight, 0]); // Not directly used for drawing bottle height, but for logic

    // Dynamic calculations based on xScale
    const baseBottleWidth = xScale.bandwidth();
    const baseBottleHeight = baseBottleWidth * bottleSVGAspectRatio;
    const spacingAfterBottle = baseBottleWidth * 0.1;
    const spacingBetweenIconLabel = baseBottleWidth * 0.15; // Vertical spacing

    // Calculate bottle position (all bottles same visual height, bottom aligned)
    const bottleVisualHeight = Math.min(baseBottleHeight, innerHeight * 0.7); // Cap bottle height
    const bottleTopY = innerHeight - bottleVisualHeight - (chartMargins.bottom / 2); // Position bottles higher

    // Block 7: Chart Component Rendering (No explicit axes, gridlines, or legend here)

    // Block 8: Main Data Visualization Rendering
    const bottleGroups = mainChartGroup.selectAll(".bottle-item-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "bottle-item-group mark")
        .attr("transform", d => `translate(${xScale(d[categoryFieldName])}, ${bottleTopY})`);

    bottleGroups.each(function(d, i) {
        const group = d3.select(this);
        const currentBottleWidth = xScale.bandwidth(); // Use actual band width
        const currentBottleHeight = currentBottleWidth * bottleSVGAspectRatio; // Maintain aspect ratio

        const fillPercentage = maxValue > 0 ? Math.max(0, (d[valueFieldName] / maxValue)) : 0;

        // Define clip path for fill effect
        const clipId = `clip-bottle-${i}`;
        group.append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("class", "clip-rect")
            .attr("x", 0)
            .attr("y", currentBottleHeight * (1 - fillPercentage))
            .attr("width", currentBottleWidth)
            .attr("height", currentBottleHeight * fillPercentage);

        // Background (empty part) bottle image
        group.append("image")
            .attr("class", "image bottle-background")
            .attr("xlink:href", fillStyle.bottleImageURL)
            .attr("width", currentBottleWidth)
            .attr("height", currentBottleHeight)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("opacity", fillStyle.bottleImageOpacity);

        // Foreground (filled part) bottle image
        group.append("image")
            .attr("class", "image bottle-foreground")
            .attr("xlink:href", fillStyle.bottleImageURL) // This will be the colored one
            .attr("width", currentBottleWidth)
            .attr("height", currentBottleHeight)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .attr("clip-path", `url(#${clipId})`);
    });

    // Add icons (flags) and labels below bottles
    const labelGroups = mainChartGroup.selectAll(".label-icon-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "label-icon-group other")
        .attr("transform", d => {
            const xPos = xScale(d[categoryFieldName]) + baseBottleWidth / 2;
            const yPos = bottleTopY + (baseBottleWidth * bottleSVGAspectRatio) + spacingAfterBottle;
            return `translate(${xPos}, ${yPos})`;
        });

    labelGroups.each(function(d) {
        const group = d3.select(this);
        const iconWidth = baseBottleWidth * 0.8; // Slightly smaller than bottle width
        const iconHeight = iconWidth * 0.75; // Aspect ratio for flags

        const iconImageUrl = (inputImages.field && inputImages.field[d[categoryFieldName]]) ?
                             inputImages.field[d[categoryFieldName]] :
                             ((inputImages.other && inputImages.other.primary) ? inputImages.other.primary : null);

        if (iconImageUrl) {
            group.append("image")
                .attr("class", "icon category-icon image")
                .attr("xlink:href", iconImageUrl)
                .attr("x", -iconWidth / 2)
                .attr("y", 0)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

        const labelTextElement = group.append("text")
            .attr("class", "label category-label text")
            .attr("x", 0)
            .attr("y", iconHeight + spacingBetweenIconLabel) // Position below icon
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Initial size
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d[categoryFieldName]);
        
        // Apply text wrapping
        const labelMaxWidth = baseBottleWidth * 1.1; // Allow slight overflow or wrap tightly
        wrapText(labelTextElement, d[categoryFieldName], labelMaxWidth, 1.1, 'top'); // Align top of text block
    });


    // Block 9: Optional Enhancements & Post-Processing
    // Font size adjustments for category labels if they were dynamic (currently fixed by fillStyle.typography)
    // The original code had complex logic for dynamic font sizing of labels.
    // For simplicity and adherence to using typography tokens, this is now simplified.
    // If dynamic sizing based on available space is critical, the estimateTextWidth and scaling logic
    // would need to be re-integrated here, overriding the fillStyle.typography.labelFontSize.
    // For now, we use the configured/default font size. The wrapText handles overflow.

    // Block 10: Cleanup & SVG Node Return
    // No temporary DOM elements to remove in this version beyond what estimateTextWidth handles internally.
    return svgRoot.node();
}
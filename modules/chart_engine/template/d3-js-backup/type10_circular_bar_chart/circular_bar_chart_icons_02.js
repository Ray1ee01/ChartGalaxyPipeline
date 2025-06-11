/* REQUIREMENTS_BEGIN
{
  "chart_type": "Circular Bar Chart",
  "chart_name": "refactored_circular_bar_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [["1", "inf"], ["0", "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "background_color", "text_color"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "categorical_markers_overlay_edge"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Could be data.colors_dark for dark themes, logic to pick one would be here if supported
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = dataColumns.find(col => col.role === "x");
    const yFieldRole = dataColumns.find(col => col.role === "y");

    if (!xFieldRole || !yFieldRole) {
        let missingRoles = [];
        if (!xFieldRole) missingRoles.push("x");
        if (!yFieldRole) missingRoles.push("y");
        const errorMsg = `Critical chart config missing: dataColumns roles [${missingRoles.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif;'>Error: ${errorMsg}</div>`);
        return null;
    }

    const xField = xFieldRole.name;
    const yField = yFieldRole.name;

    if (chartData.length === 0) {
        d3.select(containerSelector).html("<div style='color:grey; font-family: Arial, sans-serif;'>No data available to render the chart.</div>");
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    // Default typography (sensible defaults, potentially closer to original if no overrides)
    const defaultTypography = {
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography = {
        rankNumber: {
            font_family: (typography.label && typography.label.font_family) || defaultTypography.label.font_family,
            font_size: (typography.label && typography.label.font_size) || '16px', // Adjusted default
            font_weight: (typography.label && typography.label.font_weight) || "bold",
        },
        tickValue: {
            font_family: (typography.annotation && typography.annotation.font_family) || defaultTypography.annotation.font_family,
            font_size: (typography.annotation && typography.annotation.font_size) || '14px', // Adjusted default
            font_weight: (typography.annotation && typography.annotation.font_weight) || defaultTypography.annotation.font_weight,
        },
        dataLabel: {
            font_family: (typography.label && typography.label.font_family) || defaultTypography.label.font_family,
            font_size: (typography.label && typography.label.font_size) || '14px', // Adjusted default
            font_weight: (typography.label && typography.label.font_weight) || "bold",
        }
    };

    fillStyle.chartBackground = colors.background_color || '#FFFFFF';
    fillStyle.textColor = colors.text_color || '#333333';
    
    fillStyle.barColor = (colors.other && colors.other.primary) || '#008866';
    fillStyle.gridLineColor = (colors.other && colors.other.grid) || '#E0E0E0'; // Assuming a 'grid' color token
    
    fillStyle.rankCircleFill = '#FFFFFF';
    fillStyle.rankCircleStroke = (colors.other && colors.other.primary) || '#075c66';
    fillStyle.rankTextColor = (colors.other && colors.other.primary) || fillStyle.textColor;

    fillStyle.tickTextColor = fillStyle.textColor;
    fillStyle.labelTextColorOutside = fillStyle.textColor;
    fillStyle.labelTextColorInside = colors.background_color || '#FFFFFF'; // For contrast on dark bars

    // Helper function to estimate text width using canvas
    function estimateTextWidth(text, fontProps) {
        const { font_family = 'Arial, sans-serif', font_size = '12px', font_weight = 'normal' } = fontProps || {};
        const fontString = `${font_weight} ${font_size} ${font_family}`;
        try {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = fontString;
            return context.measureText(text).width;
        } catch (e) {
            const avgCharWidth = parseFloat(font_size) * 0.6;
            return text.length * avgCharWidth;
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    const mainChartGroup = svgRoot.append("g").attr("class", "main-chart-group");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 40, left: 40 }; // Increased margins for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    mainChartGroup.attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;
    
    // Adjusted radii calculations to be relative to inner dimensions
    // The chart is a semi-circle opening to the left.
    // Max radius available for the semi-circle part, considering labels might go beyond.
    const maxPossibleRadius = Math.min(innerHeight / 2, innerWidth) * 0.9; 

    const barStrokeWidth = variables.bar_width || 25; // Configurable bar width, default 25
    const iconSize = variables.icon_size || 30; // Configurable icon size
    const rankCircleRadius = (variables.rank_circle_radius || 15);

    // Define angles for the semicircle (opening to the left)
    const startAngle = Math.PI / 2;  // Top
    const endAngle = -Math.PI / 2;   // Bottom

    // Radii definitions
    // rankRadius is where rank numbers are centered.
    // innerRadiusForBars is where bars start.
    // backgroundRadiusForLines is the outermost extent of radial grid lines.
    // These need to be calculated based on number of items and available space.
    // Let's make the bar area significant.
    const labelOuterPadding = 60; // Space for labels outside bars
    const rankNumberAreaWidth = rankCircleRadius * 2 + 10; // Space for rank numbers
    const tickValueAreaWidth = 50; // Space for tick values near center

    const usableRadiusForBarsAndGrid = maxPossibleRadius - labelOuterPadding - rankNumberAreaWidth - tickValueAreaWidth;
    
    const backgroundRadiusForLines = tickValueAreaWidth + rankNumberAreaWidth + usableRadiusForBarsAndGrid;
    const rankDisplayRadius = tickValueAreaWidth + rankCircleRadius;
    const innerRadiusForBars = tickValueAreaWidth + rankNumberAreaWidth;


    // Block 5: Data Preprocessing & Transformation
    const processedChartData = JSON.parse(JSON.stringify(chartData)); // Deep copy for manipulation
    processedChartData.sort((a, b) => b[yField] - a[yField]);
    const angleStep = (startAngle - endAngle) / (processedChartData.length > 1 ? (processedChartData.length - 1) : 1);


    // Block 6: Scale Definition & Configuration
    const yMax = d3.max(processedChartData, d => d[yField]);
    const barScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 1]) // Ensure domain is not [0,0]
        .range([0, usableRadiusForBarsAndGrid > 0 ? usableRadiusForBarsAndGrid : 10]); // Ensure range is positive


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Add radial background lines
    if (processedChartData.length > 0) {
        processedChartData.forEach((d, i) => {
            const angle = startAngle - i * angleStep;
            mainChartGroup.append("line")
                .attr("class", "gridline radial")
                .attr("x1", centerX)
                .attr("y1", centerY)
                .attr("x2", centerX - backgroundRadiusForLines * Math.cos(angle))
                .attr("y2", centerY - backgroundRadiusForLines * Math.sin(angle))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", barStrokeWidth) // Use barStrokeWidth for consistency with original visual
                .attr("opacity", 0.5) // Softer look
                .attr("stroke-linecap", "round");
        });
    }
    
    // Add rank numbers
    processedChartData.forEach((d, i) => {
        const angle = startAngle - i * angleStep;
        const rankX = centerX - rankDisplayRadius * Math.cos(angle);
        const rankY = centerY - rankDisplayRadius * Math.sin(angle);
        
        mainChartGroup.append("circle")
            .attr("class", "mark rank-circle-bg")
            .attr("cx", rankX)
            .attr("cy", rankY)
            .attr("r", rankCircleRadius)
            .attr("fill", fillStyle.rankCircleFill)
            .attr("stroke", fillStyle.rankCircleStroke)
            .attr("stroke-width", 2);
            
        mainChartGroup.append("text")
            .attr("class", "text rank-text")
            .attr("x", rankX)
            .attr("y", rankY)
            .attr("font-family", fillStyle.typography.rankNumber.font_family)
            .attr("font-size", fillStyle.typography.rankNumber.font_size)
            .attr("font-weight", fillStyle.typography.rankNumber.font_weight)
            .attr("fill", fillStyle.rankTextColor)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .text(i + 1);
    });

    // Add circular tick values
    const tickCount = 5;
    const tickValues = barScale.ticks(tickCount);

    tickValues.forEach(tickValue => {
        if (tickValue === 0 && yMax > 0) return; // Don't draw 0 tick if there are other values
        const tickRadius = innerRadiusForBars + barScale(tickValue);
        
        mainChartGroup.append("text")
            .attr("class", "text axis tick-label")
            .attr("x", centerX + 5) // Position to the right of the center
            .attr("y", centerY - tickRadius)
            .attr("font-family", fillStyle.typography.tickValue.font_family)
            .attr("font-size", fillStyle.typography.tickValue.font_size)
            .attr("font-weight", fillStyle.typography.tickValue.font_weight)
            .attr("fill", fillStyle.tickTextColor)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .text(tickValue);
    });

    // Block 8: Main Data Visualization Rendering
    mainChartGroup.selectAll(".bar-line")
        .data(processedChartData)
        .enter()
        .append("line")
        .attr("class", "mark bar-line")
        .attr("x1", (d, i) => {
            const angle = startAngle - i * angleStep;
            return centerX - innerRadiusForBars * Math.cos(angle);
        })
        .attr("y1", (d, i) => {
            const angle = startAngle - i * angleStep;
            return centerY - innerRadiusForBars * Math.sin(angle);
        })
        .attr("x2", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return centerX - (innerRadiusForBars + barLength) * Math.cos(angle);
        })
        .attr("y2", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return centerY - (innerRadiusForBars + barLength) * Math.sin(angle);
        })
        .attr("stroke", fillStyle.barColor)
        .attr("stroke-width", barStrokeWidth)
        .attr("stroke-linecap", "round");

    // Block 9: Optional Enhancements & Post-Processing
    // Add icons at the end of bars
    mainChartGroup.selectAll(".bar-icon-image")
        .data(processedChartData)
        .enter()
        .each(function(d, i) { // Use 'each' to conditionally append
            const iconUrl = images.field && images.field[d[xField]] ? images.field[d[xField]] : null;
            if (iconUrl) {
                const angle = startAngle - i * angleStep;
                const barLength = barScale(d[yField]);
                const iconCenterX = centerX - (innerRadiusForBars + barLength) * Math.cos(angle);
                const iconCenterY = centerY - (innerRadiusForBars + barLength) * Math.sin(angle);

                d3.select(this).append("circle") // White background for icon
                    .attr("class", "mark icon-bg-circle")
                    .attr("cx", iconCenterX)
                    .attr("cy", iconCenterY)
                    .attr("r", iconSize / 2 + 2) // Slightly larger for a border effect
                    .attr("fill", fillStyle.rankCircleFill); // Re-use rank circle fill

                d3.select(this).append("image")
                    .attr("class", "image bar-icon")
                    .attr("x", iconCenterX - iconSize / 2)
                    .attr("y", iconCenterY - iconSize / 2)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("xlink:href", iconUrl);
            }
        });
    
    // Add value labels
    processedChartData.forEach((d, i) => {
        const angle = startAngle - i * angleStep;
        const barLength = barScale(d[yField]);
        const labelText = `${d[xField]}: ${d[yField]}`;
        
        const textFontProps = fillStyle.typography.dataLabel;
        const estimatedWidth = estimateTextWidth(labelText, textFontProps);

        // Position label: default outside, move inside if not enough space or bar is too short
        const labelOffsetFromBarEnd = 20; // How far from bar end to place label
        const labelRadius = innerRadiusForBars + barLength + labelOffsetFromBarEnd;
        
        let labelX = centerX - labelRadius * Math.cos(angle);
        let labelY = centerY - labelRadius * Math.sin(angle);
        let currentTextColor = fillStyle.labelTextColorOutside;
        let textAnchor = "end"; // Default for labels outside, to the left of anchor point

        // Check if label should be inside the bar
        // Heuristic: if bar is short, or if text is wider than bar (for very thin bars)
        // or if label would go out of chart bounds (simplified check against backgroundRadiusForLines)
        const barPixelWidth = barStrokeWidth;
        let insideFlag = false;
        if (barLength < estimatedWidth / 2 || barLength < barPixelWidth * 1.5) { // If bar is too short for external label
             insideFlag = true;
        }
        
        if (insideFlag) {
            const insideLabelRadius = innerRadiusForBars + barLength - labelOffsetFromBarEnd / 2; // Position inside, near end
            labelX = centerX - insideLabelRadius * Math.cos(angle);
            labelY = centerY - insideLabelRadius * Math.sin(angle);
            currentTextColor = fillStyle.labelTextColorInside;
            textAnchor = "start"; // For labels inside, to the right of anchor point
        }
        
        // Adjust anchor based on angle for better readability
        if (angle < 0 && angle > -Math.PI/2) { // Bottom-left quadrant
             textAnchor = insideFlag ? "start" : "end";
        } else if (angle > 0 && angle < Math.PI/2) { // Top-left quadrant
             textAnchor = insideFlag ? "start" : "end";
        }
        // For text exactly at top or bottom, middle anchor might be better if not rotated
        // but with rotation, start/end relative to the line is usually fine.

        const rotation = (angle * 180 / Math.PI);

        mainChartGroup.append("text")
            .attr("class", "text data-label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("font-family", textFontProps.font_family)
            .attr("font-size", textFontProps.font_size)
            .attr("font-weight", textFontProps.font_weight)
            .attr("fill", currentTextColor)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .attr("transform", `rotate(${rotation}, ${labelX}, ${labelY})`)
            .text(labelText);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_08",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 8]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // Note: The /* REQUIREMENTS_BEGIN ... REQUIREMENTS_END */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const {
        data: chartDataSource,
        variables = {},
        typography = {},
        colors = {},
        images = {}, // Not used in this chart, but extracted for consistency
    } = data;

    const dataColumns = chartDataSource.columns || [];
    let chartDataArray = chartDataSource.data || [];

    const xCol = dataColumns.find(c => c.role === "x");
    const yCol = dataColumns.find(c => c.role === "y");
    const groupCol = dataColumns.find(c => c.role === "group");

    const xField = xCol?.name;
    const yField = yCol?.name;
    const groupField = groupCol?.name;
    const yUnit = yCol?.unit === "none" ? "" : yCol?.unit ?? "";

    // Critical Identifier Validation
    const missingFields = [];
    if (!xField) missingFields.push("xField (from dataColumns role 'x')");
    if (!yField) missingFields.push("yField (from dataColumns role 'y')");
    if (!groupField) missingFields.push("groupField (from dataColumns role 'group')");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html(""); // Clear the container

    chartDataArray = chartDataArray.filter(d => d[yField] != null && +d[yField] > 0 && d[groupField] != null && d[xField] != null);
    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points to render after filtering.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography = {
        labelFontFamily: (typography.label && typography.label.font_family) || defaultTypography.label.font_family,
        labelFontSize: (typography.label && typography.label.font_size) || defaultTypography.label.font_size,
        labelFontWeight: (typography.label && typography.label.font_weight) || defaultTypography.label.font_weight,
        annotationFontFamily: (typography.annotation && typography.annotation.font_family) || defaultTypography.annotation.font_family,
        annotationFontSize: (typography.annotation && typography.annotation.font_size) || defaultTypography.annotation.font_size,
        annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || defaultTypography.annotation.font_weight,
    };
    
    fillStyle.textColor = colors.text_color || '#0f223b';
    fillStyle.chartBackground = colors.background_color || '#FFFFFF'; // Not directly used for SVG background, but available

    // Helper: Estimate Text Width using in-memory SVG
    function estimateTextWidth(text, fontFamily, fontSizeWithUnit, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSizeWithUnit);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // console.warn("getBBox failed for text:", text, e);
        }
        return width;
    }

    // Helper: Color Brightness Calculation
    function getColorBrightness(hexColor) {
        hexColor = hexColor.replace("#", "");
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        return (r * 299 + g * 587 + b * 114) / 1000;
    }

    // Helper: Text Color Choice for Background
    function getTextColorForBackground(bgColor) {
        // Use provided text_color if it has high contrast, otherwise choose black/white
        const bgBrightness = getColorBrightness(bgColor);
        const generalTextBrightness = getColorBrightness(fillStyle.textColor);
        
        // Check if general text color has enough contrast
        if (Math.abs(bgBrightness - generalTextBrightness) > 100) { // Heuristic threshold
            return fillStyle.textColor;
        }
        return bgBrightness > 128 ? "#000000" : "#FFFFFF";
    }
    
    // Helper: Value Formatter
    function formatValue(value) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + "M" + yUnit;
        } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + "k" + yUnit;
        } else if (value % 1 !== 0 && typeof value === 'number') {
            return value.toFixed(1) + yUnit;
        }
        return String(value) + yUnit;
    }

    // Helper: Calculate Font Size for Circle Text
    function getCircleDynamicFontSize(radius) {
        if (radius < 20) return 0;
        if (radius < 35) return 10;
        if (radius < 50) return 12;
        if (radius < 70) return 14;
        return 16;
    }

    // Helper: Text Truncation
    function fitTextToWidth(text, maxWidth, fontFamily, fontSizeWithUnit, fontWeight) {
        if (estimateTextWidth(text, fontFamily, fontSizeWithUnit, fontWeight) <= maxWidth) {
            return text;
        }
        const ellipsis = "...";
        const ellipsisWidth = estimateTextWidth(ellipsis, fontFamily, fontSizeWithUnit, fontWeight);
        if (maxWidth <= ellipsisWidth) return "";

        let low = 0;
        let high = text.length;
        let bestFit = "";
        
        while(low <= high) {
            let mid = Math.floor((low + high) / 2);
            if (mid === 0) { // Ensure we don't get stuck if mid is 0
                 if (estimateTextWidth(text.substring(0, 1) + ellipsis, fontFamily, fontSizeWithUnit, fontWeight) <= maxWidth) {
                    bestFit = text.substring(0, 1) + ellipsis;
                 } // else bestFit remains ""
                 break;
            }
            let testText = text.substring(0, mid) + ellipsis;
            if (estimateTextWidth(testText, fontFamily, fontSizeWithUnit, fontWeight) <= maxWidth) {
                bestFit = testText;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return bestFit || (ellipsisWidth <= maxWidth ? ellipsis : "");
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
        .style("background-color", fillStyle.chartBackground); // Optional: set SVG background

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendItemHeight = 20; // Approximate height for one line of legend
    const legendPadding = 10;
    const chartMargins = {
        top: legendItemHeight + 2 * legendPadding, // Space for legend
        right: 20,
        bottom: 20,
        left: 20
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // Added class

    const maxTotalCircleArea = innerWidth * innerHeight * 0.35;
    const MIN_RADIUS = 10;
    const MAX_RADIUS = Math.min(innerHeight, innerWidth) * 0.3;
    const centralCircleRadius = Math.min(innerWidth, innerHeight) * 0.25;

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupField]))];

    let nodes = chartDataArray.map((d, i) => {
        return {
            id: String(d[xField]) != null ? String(d[xField]) : `__node_${i}__`,
            label: String(d[xField]),
            value: +d[yField],
            group: d[groupField],
            // Color will be assigned after colorScale is defined
            radius: 0, // Will be calculated by radiusScale
            area: 0
        };
    }).sort((a, b) => b.value - a.value); // Sort by value for consistent radius scaling and initial layout

    // Block 6: Scale Definition & Configuration
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueGroups)
        .range(uniqueGroups.map((group, i) => {
            if (colors.field && colors.field[group]) return colors.field[group];
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[i % colors.available_colors.length];
            }
            return d3.schemeCategory10[i % d3.schemeCategory10.length];
        }));

    nodes.forEach(node => node.color = colorScale(node.group));
    
    const radiusScale = d3.scaleSqrt()
        .domain([d3.min(nodes, d => d.value) || 0, d3.max(nodes, d => d.value) || 1]) // Ensure domain is valid
        .range([20, 150]); // Initial range, might be scaled down

    nodes.forEach(node => {
        node.radius = radiusScale(node.value);
        node.area = Math.PI * node.radius * node.radius;
    });
    
    const initialTotalArea = d3.sum(nodes, d => d.area);
    if (initialTotalArea > maxTotalCircleArea && initialTotalArea > 0) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodes.forEach(node => {
            node.radius *= areaRatio;
            node.area = Math.PI * node.radius * node.radius;
        });
    }

    nodes.forEach(node => {
        node.radius = Math.max(MIN_RADIUS, Math.min(node.radius, MAX_RADIUS));
        node.area = Math.PI * node.radius * node.radius;
    });
    
    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${containerWidth / 2}, ${chartMargins.top / 2})`);

    const legendItems = legendGroup.selectAll(".legend-item")
        .data(uniqueGroups)
        .enter()
        .append("g")
        .attr("class", "legend-item other"); // Added class

    const legendItemWidth = uniqueGroups.reduce((maxWidth, group) => {
        const textWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        return Math.max(maxWidth, textWidth + 25); // 16 (rect) + 4 (padding) + 5 (text offset)
    }, 0) + 10; // Add some padding between items

    const totalLegendWidth = legendItems.size() * legendItemWidth;
    const legendStartX = -totalLegendWidth / 2;

    legendItems.attr("transform", (d, i) => `translate(${legendStartX + i * legendItemWidth}, 0)`);

    legendItems.append("rect")
        .attr("width", 16)
        .attr("height", 16)
        .attr("fill", d => colorScale(d))
        .attr("class", "mark"); // Added class

    legendItems.append("text")
        .attr("x", 20)
        .attr("y", 8) // Vertically center with 16px rect
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label") // Added class
        .text(d => d);

    // Block 8: Main Data Visualization Rendering (Circles & Labels)
    const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.03))
        .force("charge", d3.forceManyBody().strength(-15))
        .force("collide", d3.forceCollide().radius(d => d.radius + 8).strength(0.95))
        .stop();

    if (nodes.length > 0) {
        const angleStep = (2 * Math.PI) / nodes.length;
        nodes.forEach((node, i) => {
            const angle = i * angleStep;
            const distanceToCenter = centralCircleRadius + node.radius + 10;
            node.x = innerWidth / 2 + distanceToCenter * Math.cos(angle);
            node.y = innerHeight / 2 + distanceToCenter * Math.sin(angle);
            if (i < nodes.length / 3) { // Fix larger circles for stable ring
                node.fx = node.x;
                node.fy = node.y;
            }
        });
    }
    
    const MIN_ITERATIONS = 150;
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        simulation.tick();
        nodes.forEach(d => {
            if (!d.fx) { // If node is not fixed
                // Custom ring force
                const dx = d.x - innerWidth / 2;
                const dy = d.y - innerHeight / 2;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                const targetDistance = centralCircleRadius + d.radius + 10; // Target distance for ring
                const pullFactor = 0.1;
                
                if (Math.abs(currentDistance - targetDistance) > d.radius * 0.2 && currentDistance > 0) {
                    const angle = Math.atan2(dy, dx);
                    const newDistance = currentDistance * (1 - pullFactor) + targetDistance * pullFactor;
                    d.x = innerWidth / 2 + newDistance * Math.cos(angle);
                    d.y = innerHeight / 2 + newDistance * Math.sin(angle);
                }
                
                // Boundary constraints
                d.x = Math.max(d.radius + 5, Math.min(innerWidth - d.radius - 5, d.x));
                d.y = Math.max(d.radius + 5, Math.min(innerHeight - d.radius - 5, d.y));
            }
        });
    }
     // Final boundary check
    nodes.forEach(d => {
        if (!d.fx) {
            d.x = Math.max(d.radius + 5, Math.min(innerWidth - d.radius - 5, d.x));
            d.y = Math.max(d.radius + 5, Math.min(innerHeight - d.radius - 5, d.y));
        }
    });


    const circleGroups = mainChartGroup.selectAll(".circle-group")
        .data(nodes, d => d.id)
        .enter()
        .append("g")
        .attr("class", "mark-group other") // Added class
        .attr("transform", d => `translate(${d.x}, ${d.y})`);

    circleGroups.append("circle")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", "#FFFFFF") // Using white stroke for visual separation
        .attr("stroke-width", 1.5)
        .attr("class", "mark"); // Added class

    circleGroups.each(function(d) {
        const groupElement = d3.select(this);
        const dynamicFontSize = getCircleDynamicFontSize(d.radius);
        if (dynamicFontSize === 0) return;

        const textColor = getTextColorForBackground(d.color);

        // Value Label
        groupElement.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.0em") // Adjusted for two lines
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${dynamicFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight) // Use token
            .style("fill", textColor)
            .attr("class", "value label") // Added classes
            .text(formatValue(d.value));
        
        // Category Label (if circle is large enough)
        if (d.radius >= 40 && d.label) {
            const categoryFontSize = Math.max(8, dynamicFontSize - 2); // Ensure min size
            const maxTextWidth = d.radius * 1.6; // Allow slightly more width
            const truncatedLabel = fitTextToWidth(
                d.label, 
                maxTextWidth, 
                fillStyle.typography.annotationFontFamily, 
                `${categoryFontSize}px`, 
                fillStyle.typography.annotationFontWeight
            );
            
            if (truncatedLabel) {
                 groupElement.append("text")
                    .attr("text-anchor", "middle")
                    .attr("dy", `${dynamicFontSize * 0.8 + 2}px`) // Position below value label
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${categoryFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", textColor)
                    .attr("class", "label") // Added class
                    .text(truncatedLabel);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex visual effects like shadows, gradients, or patterns as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_04",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 8]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const {
        data: dataContainer,
        variables = {},
        typography: rawTypography = {},
        colors: rawColors = {},
        images: rawImages = {} // Though not used in this chart, adhere to structure
    } = data;

    if (!dataContainer || !dataContainer.data || !dataContainer.columns) {
        console.error("Data structure is invalid. Missing data.data or data.data.columns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red;'>Error: Invalid data structure provided.</div>");
        }
        return null;
    }

    const dataColumns = dataContainer.columns || [];
    let chartData = dataContainer.data || [];

    const xCol = dataColumns.find(c => c.role === "x");
    const yCol = dataColumns.find(c => c.role === "y");
    const groupCol = dataColumns.find(c => c.role === "group");

    const xFieldName = xCol?.name;
    const yFieldName = yCol?.name;
    const groupFieldName = groupCol?.name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x field" : null,
            !yFieldName ? "y field" : null,
            !groupFieldName ? "group field" : null
        ].filter(Boolean).join(", ");
        console.error(`Critical chart config missing: ${missingFields} from data.data.columns. Cannot render.`);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>Error: Critical chart configuration missing (${missingFields}).</div>`);
        }
        return null;
    }

    const yUnit = yCol?.unit === "none" || !yCol?.unit ? "" : yCol.unit;
    chartData = chartData.filter(d => d[yFieldName] != null && +d[yFieldName] > 0);

    if (chartData.length === 0) {
        console.warn("No valid data points to render after filtering.");
        d3.select(containerSelector).html("<div style='color:orange;'>No data to display.</div>");
        // return null; // Or render an empty chart structure
    }
    
    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: rawTypography.title?.font_family || "Arial, sans-serif",
            titleFontSize: rawTypography.title?.font_size || "16px",
            titleFontWeight: rawTypography.title?.font_weight || "bold",
            labelFontFamily: rawTypography.label?.font_family || "Arial, sans-serif",
            labelFontSize: rawTypography.label?.font_size || "12px",
            labelFontWeight: rawTypography.label?.font_weight || "normal",
            annotationFontFamily: rawTypography.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: rawTypography.annotation?.font_size || "10px",
            annotationFontWeight: rawTypography.annotation?.font_weight || "normal",
        },
        textColor: rawColors.text_color || "#333333",
        legendTextColor: rawColors.text_color || "#333333", // Could be different
        chartBackground: rawColors.background_color || "#FFFFFF",
        defaultCategoricalColors: ["#1e3cff", "#e01e1e", "#ffa500", "#ff69b4", "#32cd32", "#9932cc", "#8b4513", "#00ced1"],
        circleStrokeColor: "rgba(255,255,255,0.7)", // Default stroke for circles
    };

    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const SvgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(SvgNS, "svg");
        const textElement = document.createElementNS(SvgNS, "text");
        textElement.setAttribute("font-family", fontFamily);
        textElement.setAttribute("font-size", fontSize); // fontSize should be a string like "12px"
        textElement.setAttribute("font-weight", fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: getBBox on a detached element might be unreliable in some older browsers or specific environments.
        // The directive strictly forbids appending to DOM.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth with SVG getBBox failed. Text measurement might be inaccurate.", e);
            // Fallback to canvas if really needed, but sticking to SVG as per directives for now.
            // const canvas = document.createElement('canvas');
            // const context = canvas.getContext('2d');
            // context.font = `${fontWeight || 'normal'} ${fontSize} ${fontFamily}`;
            // width = context.measureText(text).width;
        }
        return width;
    };
    
    const formatValue = (value) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        if (value >= 100) return value.toFixed(0);
        if (value >= 10) return value.toFixed(1);
        return value.toFixed(2);
    };

    const getColorBrightness = (colorStr) => {
        const color = d3.rgb(colorStr);
        return (color.r * 0.299 + color.g * 0.587 + color.b * 0.114) / 255;
    };

    const getTextColorForBackground = (bgColor) => {
        return getColorBrightness(bgColor) > 0.6 ? '#000000' : '#FFFFFF';
    };

    const LARGE_CIRCLE_THRESHOLD = 40; // Radius in px
    const MEDIUM_CIRCLE_THRESHOLD = 25; // Radius in px

    const getCircleSizeCategory = (radius) => {
        if (radius < MEDIUM_CIRCLE_THRESHOLD) return "small";
        if (radius < LARGE_CIRCLE_THRESHOLD) return "medium";
        return "large";
    };

    const fitTextToWidth = (text, maxWidth, baseFontFamily, baseFontSizePx, baseFontWeight) => {
        let currentFontSize = parseInt(baseFontSizePx); // Number part of "12px"
        let fittedText = text;
    
        let textWidth = estimateTextWidth(fittedText, baseFontFamily, `${currentFontSize}px`, baseFontWeight);
    
        if (textWidth <= maxWidth) {
            return { text: fittedText, fontSize: `${currentFontSize}px` };
        }
    
        // Try reducing font size
        const minFontSize = 8; // Minimum practical font size
        while (textWidth > maxWidth && currentFontSize > minFontSize) {
            currentFontSize = Math.max(minFontSize, currentFontSize - 1);
            textWidth = estimateTextWidth(fittedText, baseFontFamily, `${currentFontSize}px`, baseFontWeight);
        }
        
        // If still too wide, truncate text
        if (textWidth > maxWidth) {
            while (textWidth > maxWidth && fittedText.length > 0) {
                fittedText = fittedText.slice(0, -1);
                textWidth = estimateTextWidth(fittedText + "...", baseFontFamily, `${currentFontSize}px`, baseFontWeight);
            }
            fittedText += "...";
        }
        return { text: fittedText, fontSize: `${currentFontSize}px` };
    };

    // Custom force for clustering, kept as an internal helper
    function d3ForceCluster() {
        let nodes = [],
            centerFunc = d => d.x, // Default to current x, effectively no change
            strength = 0.1;

        function force(alpha) {
            nodes.forEach(node => {
                const center = centerFunc(node);
                if (!center || !Array.isArray(center) || center.length < 2) return;
                const [cx, cy] = center;
                node.vx += (cx - node.x) * strength * alpha;
                node.vy += (cy - node.y) * strength * alpha;
            });
        }
        force.initialize = function(_) { nodes = _; };
        force.centers = function(_) {
            return arguments.length ? (centerFunc = typeof _ === "function" ? _ : () => _, force) : centerFunc;
        };
        force.strength = function(_) {
            return arguments.length ? (strength = +_, force) : strength;
        };
        return force;
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 900;
    const containerHeight = variables.height || 700;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "proportional-area-chart-svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: variables.marginTop ?? 60, right: variables.marginRight ?? 20, bottom: variables.marginBottom ?? 20, left: variables.marginLeft ?? 20 }; // Increased top margin for legend
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const maxTotalCircleArea = innerWidth * innerHeight * (variables.maxAreaPercentage || 0.35);
    const MIN_RADIUS = variables.minCircleRadius || 15;
    const MAX_RADIUS = Math.min(innerHeight, innerWidth) * (variables.maxCircleRadiusPercentage || 0.25);
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroups = [...new Set(chartData.map(d => d[groupFieldName]))];
    
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueGroups)
        .range(uniqueGroups.map((group, i) =>
            rawColors.field?.[groupFieldName]?.[group] ||
            (rawColors.available_colors && rawColors.available_colors[i % rawColors.available_colors.length]) ||
            fillStyle.defaultCategoricalColors[i % fillStyle.defaultCategoricalColors.length]
        ));

    const tempRadiusScale = d3.scaleSqrt()
        .domain([d3.min(chartData, d => +d[yFieldName]) || 0, d3.max(chartData, d => +d[yFieldName]) || 1])
        .range([variables.initialMinRadius || 25, variables.initialMaxRadius || 100]);

    let nodes = chartData.map((d, i) => {
        const radius = tempRadiusScale(+d[yFieldName]);
        return {
            id: d[xFieldName] != null ? String(d[xFieldName]) : `__node_${i}__`,
            label: String(d[xFieldName]),
            value: +d[yFieldName],
            group: d[groupFieldName],
            color: colorScale(d[groupFieldName]),
            radius: radius,
            area: Math.PI * radius * radius
        };
    }).sort((a, b) => b.radius - a.radius);

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

    // Block 6: Scale Definition & Configuration
    // colorScale defined above. radiusScale is effectively embedded in node processing.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, 20)`); // Position legend at top

    const legendTitleText = groupCol?.description;
    let legendTitleHeight = 0;

    if (legendTitleText) {
        legendGroup.append("text")
            .attr("class", "text legend-title")
            .attr("x", 0)
            .attr("y", 0) // Adjusted y for title
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .style("fill", fillStyle.legendTextColor)
            .text(legendTitleText);
        legendTitleHeight = parseInt(fillStyle.typography.titleFontSize) + 10; // Approx height + padding
    }
    
    const legendItemHeight = 20;
    const legendItemWidth = variables.legendItemWidth || 120;
    const itemsPerRow = Math.max(1, Math.floor(innerWidth / legendItemWidth));
    const legendEffectiveWidth = itemsPerRow * legendItemWidth;
    const legendStartX = (innerWidth - legendEffectiveWidth) / 2;

    uniqueGroups.forEach((group, i) => {
        const row = Math.floor(i / itemsPerRow);
        const col = i % itemsPerRow;
        const xPos = legendStartX + col * legendItemWidth;
        const yPos = legendTitleHeight + row * legendItemHeight;

        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${xPos}, ${yPos})`);

        itemGroup.append("circle")
            .attr("class", "mark legend-mark")
            .attr("cx", 8)
            .attr("cy", 0) // Vertically center with text
            .attr("r", 6)
            .style("fill", colorScale(group));

        itemGroup.append("text")
            .attr("class", "text legend-label")
            .attr("x", 20)
            .attr("y", 0) // Vertically center
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.legendTextColor)
            .text(group);
    });
    
    // Calculate actual legend height to adjust TOP_PROTECTED_AREA if needed
    // This is a simplified calculation. A more robust way would be getBBox of legendGroup.
    const numLegendRows = Math.ceil(uniqueGroups.length / itemsPerRow);
    const totalLegendHeight = legendTitleHeight + numLegendRows * legendItemHeight;
    const TOP_PROTECTED_AREA = Math.max(0, totalLegendHeight + 10 - chartMargins.top); // Space needed within mainChartGroup for legend clearance


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2 + (TOP_PROTECTED_AREA > 0 ? TOP_PROTECTED_AREA/2 : 10)).strength(0.05))
        .force("charge", d3.forceManyBody().strength(d => -d.radius * 0.8))
        .force("collide", d3.forceCollide().radius(d => d.radius + 7.5).strength(0.9).iterations(2))
        .stop();

    const groupCenters = {};
    uniqueGroups.forEach(group => {
        const offsetX = (Math.random() - 0.5) * (innerWidth / 10); // Spread clusters a bit
        const offsetY = (Math.random() - 0.5) * (innerHeight / 10);
        groupCenters[group] = [innerWidth / 2 + offsetX, innerHeight / 2 + offsetY];
    });
    
    simulation.force("cluster", d3ForceCluster()
        .centers(d => groupCenters[d.group])
        .strength(0.35) // Original clusterStrength
    );
    
    if (nodes.length > 0) {
        nodes[0].fx = innerWidth / 2;
        nodes[0].fy = innerHeight / 2 + (TOP_PROTECTED_AREA > 0 ? TOP_PROTECTED_AREA/2 : 10); // Adjust fixed y for legend
    }

    if (nodes.length > 1) {
        const groupCount = uniqueGroups.length;
        const angleStep = (2 * Math.PI) / Math.max(1, groupCount);
        uniqueGroups.forEach((group, groupIndex) => {
            const groupNodes = nodes.filter(d => d.group === group && !d.fx); // Don't reposition fixed nodes
            const groupAngle = groupIndex * angleStep;
            const groupX = innerWidth / 2 + Math.cos(groupAngle) * (innerWidth / 4);
            const groupY = innerHeight / 2 + Math.sin(groupAngle) * (innerHeight / 4);

            groupNodes.forEach((node, i) => {
                // Simple spread, force layout will do most of the work
                node.x = groupX + (Math.random() - 0.5) * 50;
                node.y = groupY + (Math.random() - 0.5) * 50;
            });
        });
    }
    
    simulation.nodes(nodes);

    simulation.on("tick", () => {
        // Custom collision/separation logic
        for (let i = 0; i < nodes.length; i++) {
            const nodeA = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeB = nodes[j];
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                let minDistance;
                let forceStrength;

                if (nodeA.group !== nodeB.group) { // Different groups, more separation
                    const extraPadding = (nodeA.radius + nodeB.radius) * 0.15;
                    minDistance = nodeA.radius + nodeB.radius + Math.max(extraPadding, 15);
                    forceStrength = 0.5;
                } else { // Same group, less separation (rely more on d3.forceCollide)
                    minDistance = nodeA.radius + nodeB.radius + 2; // Small fixed padding
                    forceStrength = 0.1;
                }

                if (distance < minDistance && distance > 0) {
                    const moveRatio = (minDistance - distance) / distance * forceStrength;
                    const moveX = dx * moveRatio;
                    const moveY = dy * moveRatio;

                    if (!nodeA.fx) { nodeA.x -= moveX; nodeA.y -= moveY; }
                    if (!nodeB.fx) { nodeB.x += moveX; nodeB.y += moveY; }
                }
            }
        }

        // Boundary constraints
        nodes.forEach(d => {
            if (!d.fx) {
                d.x = Math.max(d.radius + 5, Math.min(innerWidth - d.radius - 5, d.x));
            }
            if (!d.fy) { // d.fy might be fixed for the largest node
                 d.y = Math.max(d.radius + 5 + (TOP_PROTECTED_AREA > 0 ? TOP_PROTECTED_AREA : 0), Math.min(innerHeight - d.radius - 5, d.y));
            } else { // If fy is fixed, still ensure it respects TOP_PROTECTED_AREA
                 d.y = Math.max(d.radius + 5 + (TOP_PROTECTED_AREA > 0 ? TOP_PROTECTED_AREA : 0), d.y);
            }
        });
    });
    
    const NUM_ITERATIONS = variables.simulationIterations || 350;
    for (let i = 0; i < NUM_ITERATIONS; ++i) {
        simulation.tick();
    }
    // Final boundary check after simulation settles
    nodes.forEach(d => {
        if (!d.fx) {
            d.x = Math.max(d.radius + 5, Math.min(innerWidth - d.radius - 5, d.x));
        }
        if (!d.fy) {
            d.y = Math.max(d.radius + 5 + (TOP_PROTECTED_AREA > 0 ? TOP_PROTECTED_AREA : 0), Math.min(innerHeight - d.radius - 5, d.y));
        } else {
            d.y = Math.max(d.radius + 5 + (TOP_PROTECTED_AREA > 0 ? TOP_PROTECTED_AREA : 0), d.y);
        }
    });


    const markGroups = mainChartGroup.selectAll("g.mark-group")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", d => `mark-group mark-group-${d.group.replace(/\s+/g, '-').toLowerCase()}`)
        .attr("transform", d => `translate(${d.x},${d.y})`);

    markGroups.append("circle")
        .attr("class", "mark value-circle")
        .attr("r", d => d.radius)
        .style("fill", d => d.color)
        .style("stroke", fillStyle.circleStrokeColor)
        .style("stroke-width", d => Math.min(2, d.radius * 0.05));

    // Text labels for circles
    markGroups.each(function(d) {
        const groupElement = d3.select(this);
        const radius = d.radius;
        const circleTextColor = getTextColorForBackground(d.color);
        const formattedValueWithUnit = formatValue(d.value) + yUnit;
        const sizeCategory = getCircleSizeCategory(radius);

        const baseLabelFontSize = (sizeCategory === "large") ? fillStyle.typography.labelFontSize : fillStyle.typography.annotationFontSize;
        const baseLabelFontWeight = (sizeCategory === "large") ? fillStyle.typography.labelFontWeight : fillStyle.typography.annotationFontWeight;
        
        if (sizeCategory === "small") {
            if (radius >= MEDIUM_CIRCLE_THRESHOLD * 0.6) { // Only if circle is somewhat visible
                groupElement.append("text")
                    .attr("class", "text data-label value-text")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("fill", circleTextColor)
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${Math.min(parseInt(fillStyle.typography.annotationFontSize), radius / 1.5)}px`) // Dynamic small font
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .text(formattedValueWithUnit);
            }
            // Label outside for small circles, appended to mainChartGroup for better layout control if they overlap
            mainChartGroup.append("text")
                .attr("class", "text data-label name-text external-label")
                .attr("x", d.x)
                .attr("y", d.y + radius + parseInt(fillStyle.typography.annotationFontSize)) // Position below circle
                .attr("text-anchor", "middle")
                .style("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(d.label);

        } else if (sizeCategory === "medium") {
            groupElement.append("text")
                .attr("class", "text data-label value-text")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("fill", circleTextColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${Math.min(parseInt(fillStyle.typography.labelFontSize), radius / 1.8)}px`) // Dynamic medium font
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .text(formattedValueWithUnit);

            // Label outside for medium circles as well, for consistency or if space is tight
             mainChartGroup.append("text")
                .attr("class", "text data-label name-text external-label")
                .attr("x", d.x)
                .attr("y", d.y + radius + parseInt(fillStyle.typography.labelFontSize))
                .attr("text-anchor", "middle")
                .style("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .text(d.label);

        } else { // Large circles
            const maxTextWidth = radius * 1.6; // Max width for label text inside circle
            const { text: fittedLabelText, fontSize: fittedLabelSize } = fitTextToWidth(
                d.label,
                maxTextWidth,
                fillStyle.typography.labelFontFamily,
                baseLabelFontSize, // e.g., "12px"
                fillStyle.typography.labelFontWeight
            );

            groupElement.append("text")
                .attr("class", "text data-label name-text")
                .attr("text-anchor", "middle")
                .attr("y", -radius * 0.15) // Position label slightly up
                .style("fill", circleTextColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fittedLabelSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .text(fittedLabelText);

            groupElement.append("text")
                .attr("class", "text data-label value-text")
                .attr("text-anchor", "middle")
                .attr("y", radius * 0.25) // Position value slightly down
                .style("fill", circleTextColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${Math.min(parseInt(fittedLabelSize), parseInt(fillStyle.typography.labelFontSize) * 0.9)}px`) // Value text slightly smaller than label
                .style("font-weight", "bold") // Values often bold
                .text(formattedValueWithUnit);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements)
    // No additional enhancements specified beyond core chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_09",
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

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const configVariables = data.variables || {};
    const configTypography = data.typography || {};
    const configColors = data.colors || (data.colors_dark || {});
    const configImages = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data?.columns || [];
    let chartDataArray = data.data?.data || [];

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldCol?.name;
    const yFieldName = yFieldCol?.name;
    const groupFieldName = groupFieldCol?.name;
    const yUnitName = yFieldCol?.unit === "none" ? "" : (yFieldCol?.unit || "");

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x field (role='x')");
        if (!yFieldName) missingFields.push("y field (role='y')");
        if (!groupFieldName) missingFields.push("group field (role='group')");
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html(""); // Clear the container

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: configTypography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: configTypography.title?.font_size || '16px',
            titleFontWeight: configTypography.title?.font_weight || 'bold',
            labelFontFamily: configTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: configTypography.label?.font_size || '12px',
            labelFontWeight: configTypography.label?.font_weight || 'normal',
            annotationFontFamily: configTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: configTypography.annotation?.font_size || '10px',
            annotationFontWeight: configTypography.annotation?.font_weight || 'normal',
        },
        colors: {
            textColor: configColors.text_color || '#333333',
            backgroundColor: configColors.background_color || '#FFFFFF', // Not directly used on SVG if transparent
            primary: configColors.other?.primary || '#1e3cff',
            categoryColorMapping: configColors.field || {},
            availableColors: configColors.available_colors || ["#1e3cff", "#e01e1e", "#ffa500", "#ff69b4", "#32cd32", "#9932cc", "#8b4513", "#00ced1"],
        },
        images: { // Not used in this chart
            categoryImageMapping: configImages.field || {},
            otherImageMapping: configImages.other || {},
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttributeNS(null, 'font-family', fontFamily);
        tempText.setAttributeNS(null, 'font-size', fontSize);
        tempText.setAttributeNS(null, 'font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            width = text.length * avgCharWidth;
        }
        return width;
    }

    function getColorBrightness(hexColor) {
        if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#')) return 0.5;
        const hex = hexColor.slice(1);
        const r = parseInt(hex.length === 3 ? hex.slice(0, 1).repeat(2) : hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.length === 3 ? hex.slice(1, 2).repeat(2) : hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.length === 3 ? hex.slice(2, 3).repeat(2) : hex.slice(4, 6), 16) / 255;
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    function getTextColorForBackground(bgColor, lightColor = '#FFFFFF', darkColor = '#000000') {
        return getColorBrightness(bgColor) > 0.6 ? darkColor : lightColor;
    }

    function formatValue(value, unit = "") {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + "M" + unit;
        } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + "k" + unit;
        } else {
            return value.toString() + unit;
        }
    }
    
    function getCircleLabelFontSize(radius) {
        if (radius < 20) return 0;
        if (radius < 30) return 8;
        if (radius < 40) return 10;
        if (radius < 50) return 12;
        if (radius < 70) return 14;
        return 16;
    }

    function fitTextToWidth(text, maxWidth, fontFamily, fontSize, fontWeight, textEstimator) {
        if (!text || maxWidth <= 0) return "";
        
        const currentWidth = textEstimator(text, fontFamily, fontSize, fontWeight);
        if (currentWidth <= maxWidth) return text;

        const ellipsis = "...";
        const ellipsisWidth = textEstimator(ellipsis, fontFamily, fontSize, fontWeight);
        if (maxWidth <= ellipsisWidth) return ""; 

        let truncatedText = text;
        const targetWidth = maxWidth - ellipsisWidth;
        while (textEstimator(truncatedText, fontFamily, fontSize, fontWeight) > targetWidth && truncatedText.length > 0) {
            truncatedText = truncatedText.slice(0, -1);
        }
        return truncatedText + ellipsis;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = configVariables.width || 900;
    const containerHeight = configVariables.height || 700;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root");
        // .style("background-color", fillStyle.colors.backgroundColor); // Optional: set background on SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 20, bottom: 20, left: 20 }; // Increased top margin for legend + group labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const maxTotalCircleArea = innerWidth * innerHeight * 0.35;
    const MIN_RADIUS = 15;
    const MAX_RADIUS = Math.min(innerHeight, innerWidth) * 0.25;
    const centralCircleRadius = Math.min(innerWidth, innerHeight) * 0.25;

    // Block 5: Data Preprocessing & Transformation
    chartDataArray = chartDataArray.filter(d => d[yFieldName] != null && +d[yFieldName] > 0 && d[groupFieldName] != null && d[xFieldName] != null);
    if (chartDataArray.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.colors.textColor)
            .text("No valid data to display.");
        return svgRoot.node();
    }
    
    const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort();


    // Block 6: Scale Definition & Configuration
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueGroups)
        .range(uniqueGroups.map((group, i) =>
            fillStyle.colors.categoryColorMapping[group] ||
            fillStyle.colors.availableColors[i % fillStyle.colors.availableColors.length]
        ));

    const initialRadiusScale = d3.scaleSqrt()
        .domain([
            d3.min(chartDataArray, d => +d[yFieldName]) || 1, // Ensure domain is not [0,0]
            d3.max(chartDataArray, d => +d[yFieldName]) || 1
        ])
        .range([25, 100]);

    let nodes = chartDataArray.map((d, i) => {
        const radius = initialRadiusScale(+d[yFieldName]);
        return {
            id: String(d[xFieldName]) || `__node_${i}__`,
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


    // Block 7: Chart Component Rendering (Legend, Group Labels)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${containerWidth / 2}, ${chartMargins.top / 2.5})`); // Position legend in top margin

    const legendItemWidth = 100; // Approximate width per item
    const totalLegendWidth = uniqueGroups.length * legendItemWidth;
    let legendStartX = -totalLegendWidth / 2;

    // Adjust start X if legend overflows left margin
    if (containerWidth / 2 + legendStartX < chartMargins.left) {
        legendStartX = chartMargins.left - containerWidth / 2 + 10; // Add small padding
    }
    
    uniqueGroups.forEach((group, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendStartX + i * legendItemWidth}, 0)`);

        itemGroup.append("rect")
            .attr("class", "mark legend-color-sample")
            .attr("width", 16)
            .attr("height", 16)
            .attr("fill", colorScale(group));

        itemGroup.append("text")
            .attr("class", "text legend-label")
            .attr("x", 22)
            .attr("y", 8) // Vertically center with rect
            .attr("dominant-baseline", "central")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.colors.textColor)
            .text(group);
    });

    const groupCenters = {};
    if (uniqueGroups.length > 0) {
        const angleStep = (2 * Math.PI) / uniqueGroups.length;
        uniqueGroups.forEach((group, i) => {
            const angle = i * angleStep;
            const distance = centralCircleRadius * 0.8;
            const centerX = innerWidth / 2 + distance * Math.cos(angle);
            const centerY = innerHeight / 2 + distance * Math.sin(angle);
            groupCenters[group] = [centerX, centerY];
        });
    }
    
    const groupLabelElements = mainChartGroup.selectAll(".group-label-text")
        .data(uniqueGroups.filter(group => groupCenters[group]))
        .enter()
        .append("text")
        .attr("class", "text group-label-text")
        .attr("x", group => groupCenters[group][0])
        .attr("y", group => Math.max(parseFloat(fillStyle.typography.labelFontSize), groupCenters[group][1] - 40)) // Ensure not too high
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize) // Larger than annotation for group names
        .style("font-weight", "bold")
        .attr("fill", group => colorScale(group))
        .text(group => group);


    // Block 8: Main Data Visualization Rendering (Force Simulation & Circles)
    const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2 + 10).strength(0.05))
        .force("charge", d3.forceManyBody().strength(d => -d.radius * 0.8))
        .force("collide", d3.forceCollide().radius(d => d.radius + 7.5).strength(0.9).iterations(2))
        .stop();

    simulation.force("group-collide", (alpha) => {
        const quadtree = d3.quadtree().x(d => d.x).y(d => d.y).addAll(nodes);
        nodes.forEach(node => {
            const r = node.radius;
            const nx1 = node.x - r, nx2 = node.x + r, ny1 = node.y - r, ny2 = node.y + r;
            quadtree.visit((quad, x1, y1, x2, y2) => {
                if (!quad.length) {
                    do {
                        const otherNode = quad.data;
                        if (otherNode && otherNode !== node && node.group !== otherNode.group) {
                            const x = node.x - otherNode.x;
                            const y = node.y - otherNode.y;
                            const l = Math.sqrt(x * x + y * y);
                            const R = node.radius + otherNode.radius + 15; // Extra 15px for inter-group
                            if (l < R) {
                                const f = Math.min(0.1, (l - R) / l) * alpha;
                                node.vx -= x * f;
                                node.vy -= y * f;
                            }
                        }
                    } while (quad = quad.next);
                }
                return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
            });
        });
    });

    function createClusterForce(clusterNodes, centers, groupName, strength = 0.15) {
        return function(alpha) {
            const center = centers[groupName];
            if (!center) return;
            clusterNodes.forEach(node => {
                if (node.group === groupName) {
                    node.vx += (center[0] - node.x) * strength * alpha;
                    node.vy += (center[1] - node.y) * strength * alpha;
                }
            });
        };
    }

    if (uniqueGroups.length > 0) {
        uniqueGroups.forEach(group => {
            simulation.force(`cluster-${group}`, createClusterForce(nodes, groupCenters, group, 0.2));
        });
    }

    if (nodes.length > 0) {
        const groupCounts = {};
        uniqueGroups.forEach(group => {
            groupCounts[group] = nodes.filter(d => d.group === group).length;
        });

        nodes.forEach((node, i) => {
            const groupIndex = uniqueGroups.indexOf(node.group);
            const nodesInGroup = groupCounts[node.group] || 1;
            const angle = (2 * Math.PI) / uniqueGroups.length * groupIndex;
            const inGroupIndex = nodes.filter(n => n.group === node.group).indexOf(node);
            const inGroupAngle = angle + (Math.PI / (nodesInGroup + 1)) * (inGroupIndex + 1) * 0.5;
            const distance = centralCircleRadius + node.radius * 1.5;
            
            node.x = innerWidth / 2 + distance * Math.cos(inGroupAngle);
            node.y = innerHeight / 2 + distance * Math.sin(inGroupAngle);

            if (inGroupIndex < nodesInGroup / 3) { // Fix larger circles in each group
                node.fx = node.x;
                node.fy = node.y;
            }
        });
    }
    
    const MIN_ITERATIONS = 200;
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        simulation.tick();
        nodes.forEach(d => {
            if (!d.fx) {
                const dx = d.x - innerWidth / 2;
                const dy = d.y - innerHeight / 2;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const targetDistance = centralCircleRadius + d.radius * 1.2;
                const factor = 0.08;
                if (Math.abs(dist - targetDistance) > d.radius * 0.3) {
                    const angle = Math.atan2(dy, dx);
                    d.x = innerWidth / 2 + (dist * (1 - factor) + targetDistance * factor) * Math.cos(angle);
                    d.y = innerHeight / 2 + (dist * (1 - factor) + targetDistance * factor) * Math.sin(angle);
                }
                d.x = Math.max(d.radius + 5, Math.min(innerWidth - d.radius - 5, d.x));
                d.y = Math.max(d.radius, Math.min(innerHeight - d.radius - 5, d.y)); // Top protected area is 0 within mainChartGroup
            }
        });
    }

    const bubbleGroups = mainChartGroup.selectAll(".bubble-group")
        .data(nodes, d => d.id)
        .enter()
        .append("g")
        .attr("class", "mark bubble-group")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    bubbleGroups.append("circle")
        .attr("class", "mark bubble-circle")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", "#FFFFFF")
        .attr("stroke-width", 1.5);

    bubbleGroups.each(function(d) {
        const groupElement = d3.select(this);
        const labelFontSize = getCircleLabelFontSize(d.radius);
        if (labelFontSize === 0) return;

        const textColor = getTextColorForBackground(d.color, fillStyle.colors.backgroundColor, fillStyle.colors.textColor);
        
        // Value text
        groupElement.append("text")
            .attr("class", "text value-text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("y", -labelFontSize / 4) // Slightly up
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${labelFontSize}px`)
            .style("font-weight", "bold")
            .attr("fill", textColor)
            .text(formatValue(d.value, yUnitName));

        // Label text (xFieldName)
        if (d.radius > 30 && d.label) {
            const itemLabelFontSize = Math.max(8, labelFontSize - 2);
            const maxWidth = d.radius * 1.5; // Max width for label text
            const truncatedLabel = fitTextToWidth(
                d.label, 
                maxWidth, 
                fillStyle.typography.annotationFontFamily, 
                `${itemLabelFontSize}px`, 
                fillStyle.typography.annotationFontWeight,
                (txt, ff, fs, fw) => estimateTextWidth(txt, ff, fs, fw)
            );

            if (truncatedLabel) {
                 groupElement.append("text")
                    .attr("class", "text item-label-text")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "central")
                    .attr("y", labelFontSize * 0.8) // Below value text
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${itemLabelFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .attr("fill", textColor)
                    .text(truncatedLabel);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex visual effects like shadows are applied.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
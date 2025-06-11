/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_07",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["none"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a proportional area chart using circles, positioned by a force simulation.
    // A legend is displayed at the top. Icons and value labels can be shown within circles.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const dataColumns = data.data?.columns || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed in data.colors_dark
    const images = data.images || {};

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const yUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");

    if (!xField || !yField) {
        const missingFields = [];
        if (!xField) missingFields.push("xField (role: 'x')");
        if (!yField) missingFields.push("yField (role: 'y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const chartDataArray = chartDataInput.filter(d => d[yField] != null && !isNaN(parseFloat(d[yField])) && +d[yField] > 0);

    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div style='font-family: sans-serif;'>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typography.title?.font_size || '16px',
            titleFontWeight: typography.title?.font_weight || 'bold',
            labelFontFamily: typography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typography.label?.font_size || '12px',
            labelFontWeight: typography.label?.font_weight || 'normal',
            annotationFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typography.annotation?.font_size || '10px',
            annotationFontWeight: typography.annotation?.font_weight || 'normal',
        },
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#0f223b',
        defaultStrokeColor: '#FFFFFF', // For circle strokes
        primaryColor: colors.other?.primary || '#1f77b4',
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // getBBox on an unattached SVG text element is generally reliable for width.
        return textElement.getBBox().width;
    }

    function getColorBrightness(hexColor) {
        if (!hexColor || !hexColor.startsWith('#')) return 0.5; // Default for non-hex or invalid
        let hex = hexColor.substring(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        if (hex.length !== 6) return 0.5;

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }

    function getTextColorForBackground(backgroundColorHex) {
        const brightness = getColorBrightness(backgroundColorHex);
        return brightness > 0.6 ? '#000000' : '#FFFFFF'; // Dark text on light, light text on dark
    }

    const getIconSize = (radius, minSize = 20, maxSize = 60, ratio = 0.4) => {
        return Math.max(minSize, Math.min(radius * ratio * 2, maxSize));
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    // Legend properties
    const legendItemHeight = 30;
    const legendIconSize = 20;
    const legendIconPadding = 10; // Padding between icon and text in a legend item
    const legendCategoryPadding = 20; // Padding between legend items

    // Calculate legend layout first to determine top margin for the chart
    const uniqueCategoriesForLegend = [...new Set(chartDataArray.map(d => d[xField]))];
    const legendMarginConfig = { top: 30, right: 20, bottom: 10, left: 20 }; // Relative to SVG
    const maxLegendWidth = containerWidth - legendMarginConfig.left - legendMarginConfig.right;
    
    let legendCurrentRow = 0;
    let legendCurrentRowWidth = 0;
    const legendItemWidths = uniqueCategoriesForLegend.map(item => {
        const textWidth = estimateTextWidth(
            item,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontWeight
        );
        return legendIconSize + legendIconPadding + textWidth + legendCategoryPadding;
    });

    legendItemWidths.forEach(width => {
        if (legendCurrentRowWidth + width > maxLegendWidth && legendCurrentRowWidth > 0) {
            legendCurrentRow++;
            legendCurrentRowWidth = width;
        } else {
            legendCurrentRowWidth += width;
        }
    });
    const calculatedLegendHeight = (legendCurrentRow + 1) * legendItemHeight + legendMarginConfig.bottom;
    
    const chartMargins = {
        top: legendMarginConfig.top + calculatedLegendHeight, // Ensure space for legend
        right: 20,
        bottom: 60,
        left: 20
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const maxTotalCircleArea = innerWidth * innerHeight * 0.5;
    const minRadius = 5;
    const maxRadius = Math.min(innerWidth, innerHeight) / 3; // Max radius relative to smaller dimension of chart area

    const TOP_PROTECTED_AREA_SIM = 0; // Was 30, but legend space is now handled by margin.top
                                     // If needed, this would be an offset from the top of the force sim area (innerHeight)

    // Block 5: Data Preprocessing & Transformation
    const uniqueCategories = [...new Set(chartDataArray.map(d => d[xField]))];
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueCategories)
        .range(uniqueCategories.map((cat, i) =>
            colors.field?.[cat] ||
            (colors.available_colors?.[i % colors.available_colors.length]) ||
            d3.schemeCategory10[i % d3.schemeCategory10.length]
        ));

    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(chartDataArray, d => +d[yField])])
        .range([minRadius, maxRadius * 0.8]); // Initial max radius slightly smaller

    let nodesData = chartDataArray.map((d, i) => {
        const value = +d[yField];
        const radius = radiusScale(value);
        const category = d[xField];
        return {
            id: String(category != null ? category : `__node_${i}__`), // Ensure unique ID
            value: value,
            radius: radius,
            area: Math.PI * radius * radius,
            color: colorScale(category),
            iconUrl: images.field?.[category] || (images.other?.primary && uniqueCategories.length === 1 ? images.other.primary : null),
            rawData: d
        };
    }).sort((a, b) => b.radius - a.radius);

    const initialTotalArea = d3.sum(nodesData, d => d.area);
    if (initialTotalArea > maxTotalCircleArea && initialTotalArea > 0) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodesData.forEach(node => {
            node.radius *= areaRatio;
            node.area = Math.PI * node.radius * node.radius;
        });
    }
    
    const centralCircleRadius = Math.min(innerWidth, innerHeight) * 0.25;

    if (nodesData.length > 0) {
        const totalAngle = 2 * Math.PI;
        const angleStep = totalAngle / nodesData.length;
        for (let i = 0; i < nodesData.length; i++) {
            const angle = i * angleStep;
            const node = nodesData[i];
            const distance = centralCircleRadius + node.radius + 10;
            node.x = innerWidth / 2 + distance * Math.cos(angle);
            node.y = innerHeight / 2 + distance * Math.sin(angle);
            if (i < nodesData.length / 3) { // Fix larger circles for stability
                node.fx = node.x;
                node.fy = node.y;
            }
        }
    }
    
    const simulation = d3.forceSimulation(nodesData)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.05))
        .force("charge", d3.forceManyBody().strength(-10))
        .force("collide", d3.forceCollide().radius(d => d.radius + 2).strength(0.9)) // Increased padding slightly
        .stop();

    const numIterations = 200;
    for (let i = 0; i < numIterations; ++i) {
        simulation.tick();
        nodesData.forEach(d => {
            if (!d.fx) { // If node is not fixed
                // Maintain somewhat circular arrangement for non-fixed nodes
                const dx = d.x - innerWidth / 2;
                const dy = d.y - innerHeight / 2;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                const targetDistance = centralCircleRadius + d.radius + 10; // Target distance from center
                const factor = 0.1; // Strength of pull towards target distance

                if (Math.abs(currentDistance - targetDistance) > d.radius * 0.2) {
                    const angle = Math.atan2(dy, dx);
                    d.x = innerWidth / 2 + (currentDistance * (1 - factor) + targetDistance * factor) * Math.cos(angle);
                    d.y = innerHeight / 2 + (currentDistance * (1 - factor) + targetDistance * factor) * Math.sin(angle);
                }
            }
            // Boundary constraints
            d.x = Math.max(d.radius, Math.min(innerWidth - d.radius, d.x));
            d.y = Math.max(d.radius + TOP_PROTECTED_AREA_SIM, Math.min(innerHeight - d.radius, d.y));
        });
    }

    // Block 6: Scale Definition & Configuration
    // Scales (colorScale, radiusScale) are defined in Block 5 as they are integral to data preprocessing.

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendMarginConfig.left}, ${legendMarginConfig.top})`);

    let currentX = 0;
    let currentRow = 0;
    uniqueCategoriesForLegend.forEach((category, index) => {
        const itemWidth = legendItemWidths[index];
        if (currentX + itemWidth > maxLegendWidth && currentX > 0) {
            currentRow++;
            currentX = 0;
        }

        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, ${currentRow * legendItemHeight})`);

        legendItem.append("rect")
            .attr("width", legendIconSize)
            .attr("height", legendIconSize)
            .attr("fill", colorScale(category))
            .attr("class", "mark");

        const categoryIconUrl = images.field?.[category];
        if (categoryIconUrl) {
            legendItem.append("image")
                .attr("xlink:href", categoryIconUrl)
                .attr("x", 1) // Small offset for border
                .attr("y", 1)
                .attr("width", legendIconSize - 2)
                .attr("height", legendIconSize - 2)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("class", "icon image");
        }

        legendItem.append("text")
            .attr("x", legendIconSize + legendIconPadding)
            .attr("y", legendIconSize / 2)
            .attr("dominant-baseline", "central")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("class", "label")
            .text(category);
        
        currentX += itemWidth;
    });


    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const nodeGroups = mainChartGroup.selectAll("g.node-mark")
        .data(nodesData, d => d.id)
        .join("g")
        .attr("class", "mark node-mark") // "mark" for the data element, "node-mark" for specificity
        .attr("transform", d => `translate(${d.x},${d.y})`);

    nodeGroups.append("circle")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.defaultStrokeColor)
        .attr("stroke-width", 1.5); // Slightly thicker stroke for better visibility

    nodeGroups.each(function(d) {
        const group = d3.select(this);
        const iconDisplaySize = getIconSize(d.radius);

        if (d.iconUrl) {
            group.append("image")
                .attr("xlink:href", d.iconUrl)
                .attr("width", iconDisplaySize)
                .attr("height", iconDisplaySize)
                .attr("x", -iconDisplaySize / 2)
                .attr("y", -iconDisplaySize / 2)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("class", "icon image");
        }

        // Value labels
        if (d.radius >= 20) { // Only show label if circle is reasonably large
            const valueTextColor = getTextColorForBackground(d.color);
            // Dynamic font size for in-circle labels, respecting original intent
            const dynamicFontSize = Math.max(10, Math.min(d.radius / 3.5, 24)); // Adjusted for better fit

            group.append("text")
                .attr("class", "label value-label")
                .attr("text-anchor", "middle")
                .attr("y", d.radius * 0.35) // Position towards bottom inside circle
                .attr("fill", valueTextColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${dynamicFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .text(d.value + yUnit);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No additional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
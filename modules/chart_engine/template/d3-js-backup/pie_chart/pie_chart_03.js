/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pie Chart",
  "chart_name": "pie_chart_03_d3",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === 'x')?.name;
    const valueFieldName = dataColumns.find(col => col.role === 'y')?.name;

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: categoryField or valueField name not found in dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing (category or value field name).</div>");
        }
        return null;
    }

    if (chartData.length === 0) {
        console.warn("No data provided to chart.");
        // Optionally render a "no data" message
        // d3.select(containerSelector).html("<div style='text-align:center; padding: 20px;'>No data available to display.</div>");
        // return null; // Or let it render an empty chart
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    // Typography defaults
    fillStyle.typography.defaultFontFamily = "Arial, sans-serif";
    fillStyle.typography.defaultFontSize = "12px";
    fillStyle.typography.defaultFontWeight = "normal";

    fillStyle.typography.labelFontFamily = typographyInput.label?.font_family || fillStyle.typography.defaultFontFamily;
    fillStyle.typography.labelFontSize = typographyInput.label?.font_size || fillStyle.typography.defaultFontSize;
    fillStyle.typography.labelFontWeight = typographyInput.label?.font_weight || fillStyle.typography.defaultFontWeight;
    // Add other typography roles (title, annotation) if they were used, applying same default logic.
    // For this chart, only 'label' is actively used for slice labels.

    // Color defaults
    fillStyle.textColor = colorsInput.text_color || '#333333';
    fillStyle.backgroundColor = colorsInput.background_color || '#FFFFFF'; // Default to white background
    fillStyle.defaultSliceColor = (colorsInput.other && colorsInput.other.primary) || '#4682B4';
    fillStyle.sliceStrokeColor = '#FFFFFF'; // Stroke for pie slices

    function estimateTextWidth(text, fontProps) {
        if (!text || !fontProps) return 0;
        const { fontFamily, fontSize, fontWeight } = fontProps;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Do NOT append tempSvg to the DOM
        const width = tempText.getBBox().width;
        return width;
    }

    function estimateTextHeight(fontProps) {
        if (!fontProps || !fontProps.fontSize) return 0;
        const fontSizeNum = parseFloat(fontProps.fontSize);
        return fontSizeNum * 1.2; // Common approximation
    }
    
    function fitTextToWidth(text, originalFontProps, maxWidth, minFontSize = 10) {
        if (!text) return { text: "", fontProps: originalFontProps };
    
        let currentText = text;
        let currentFontSizeNum = parseFloat(originalFontProps.fontSize);
        let currentFontProps = { ...originalFontProps, fontSize: `${currentFontSizeNum}px` };
    
        let textWidth = estimateTextWidth(currentText, currentFontProps);
    
        while (textWidth > maxWidth && currentFontSizeNum > minFontSize) {
            currentFontSizeNum = Math.max(minFontSize, currentFontSizeNum - 1);
            currentFontProps.fontSize = `${currentFontSizeNum}px`;
            textWidth = estimateTextWidth(currentText, currentFontProps);
        }
    
        if (textWidth > maxWidth) {
            const ellipsis = "...";
            const ellipsisWidth = estimateTextWidth(ellipsis, currentFontProps);
            if (maxWidth < ellipsisWidth && text.length > 0) { // Not enough space even for "..."
                 currentText = "";
            } else {
                let M = currentText.length;
                while (estimateTextWidth(currentText.substring(0, M) + (M < text.length ? ellipsis : ""), currentFontProps) > maxWidth && M > 0) {
                    M--;
                }
                if (M === 0 && text.length > 0) currentText = ""; // Cannot fit even one char + ellipsis
                else if (M < text.length) currentText = currentText.substring(0, M) + ellipsis;
                // If currentText became just "..." and original was longer, ensure it's not just ellipsis
                if (currentText === ellipsis && text !== ellipsis) {
                    if (M > 0) currentText = text.substring(0,1) + ellipsis; // Show first char + ...
                    else currentText = ""; // Cannot fit
                }
            }
        }
        return { text: currentText, fontProps: currentFontProps };
    }

    function getBrightness(hexColor) {
        if (!hexColor || typeof hexColor !== 'string' || hexColor.length < 4) return 128; // Default for invalid
        let cleanHex = hexColor.replace("#", "");
        if (cleanHex.length === 3) {
            cleanHex = cleanHex.split('').map(char => char + char).join('');
        }
        if (cleanHex.length !== 6) return 128; // Invalid format after cleaning
        const r = parseInt(cleanHex.substring(0, 2), 16);
        const g = parseInt(cleanHex.substring(2, 4), 16);
        const b = parseInt(cleanHex.substring(4, 6), 16);
        if (isNaN(r) || isNaN(g) || isNaN(b)) return 128; // Parsing failed
        return (r * 299 + g * 587 + b * 114) / 1000;
    }

    // calculateLabelPosition: Adapted from original, simplified assumptions
    // iconCentroid: [x,y] of the icon area's center
    // iconVisualRadius: A measure of the icon area's size (e.g., its radius if circular)
    // contextInnerRadius, contextOuterRadius: Radii defining the general area for label placement (e.g., 0 to pie radius)
    function calculateLabelPosition(d_arc, iconCentroid, iconVisualRadius, contextInnerRadius, contextOuterRadius, textWidth, textHeight) {
        const angle = (d_arc.startAngle + d_arc.endAngle) / 2;
        const safetyDistance = iconVisualRadius + Math.max(textWidth, textHeight) / 1.5 + 10; // Added base padding

        let labelRadius;

        if (angle >= 0 && angle <= Math.PI / 4) { // Right-top
            labelRadius = contextOuterRadius + safetyDistance / 2.5;
        } else if (angle > Math.PI / 4 && angle <= 3 * Math.PI / 4) { // Top
            labelRadius = contextOuterRadius + safetyDistance / 2;
        } else if (angle > 3 * Math.PI / 4 && angle <= 5 * Math.PI / 4) { // Left
            labelRadius = Math.max(contextInnerRadius - safetyDistance / 1.8, contextInnerRadius * 0.4);
             if (labelRadius > 0) labelRadius = contextOuterRadius + safetyDistance / 2.5; // If trying to go inside a filled pie, push outside
             else labelRadius = contextOuterRadius + safetyDistance / 2.5; // Default to outside for pie
        } else if (angle > 5 * Math.PI / 4 && angle <= 7 * Math.PI / 4) { // Bottom
            labelRadius = contextOuterRadius + safetyDistance / 2;
        } else { // Right-bottom
            labelRadius = contextOuterRadius + safetyDistance / 2.5;
        }
        
        // Ensure labels are always outside the main pie radius if contextOuterRadius is the pie radius
        labelRadius = Math.max(labelRadius, contextOuterRadius + 15);


        let x = Math.sin(angle) * labelRadius;
        let y = -Math.cos(angle) * labelRadius;
        
        const distToIconCenter = Math.sqrt(Math.pow(x - iconCentroid[0], 2) + Math.pow(y - iconCentroid[1], 2));
        
        if (distToIconCenter < safetyDistance) {
            const extraFactor = 1.5; 
            const neededShift = (safetyDistance - distToIconCenter) * extraFactor;
            labelRadius += neededShift;
            x = Math.sin(angle) * labelRadius;
            y = -Math.cos(angle) * labelRadius;
        }
        return [x, y];
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
        .style("background-color", fillStyle.backgroundColor);
    
    const mainChartGroup = svgRoot.append("g").attr("class", "main-chart-group");
    const defs = svgRoot.append("defs"); // Define defs at SVG root level

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.marginTop || 40, 
        right: variables.marginRight || 40, 
        bottom: variables.marginBottom || 40, 
        left: variables.marginLeft || 40 
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const radius = Math.min(innerWidth, innerHeight) / 2 * (variables.pieRadiusFactor || 0.8); // Allow some space for labels

    const centerX = innerWidth / 2 + chartMargins.left;
    const centerY = innerHeight / 2 + chartMargins.top;

    mainChartGroup.attr("transform", `translate(${centerX}, ${centerY})`);

    const iconInnerRadiusFactor = variables.iconInnerRadiusFactor || 0.5;
    const iconOuterRadiusFactor = variables.iconOuterRadiusFactor || 1.0;
    const pieIconInnerRadius = radius * iconInnerRadiusFactor;
    const pieIconOuterRadius = radius * iconOuterRadiusFactor;


    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartData, d => d[valueFieldName]);
    const processedData = chartData.map(d => ({
        ...d,
        percentage: totalValue === 0 ? 0 : (d[valueFieldName] / totalValue) * 100
    }));

    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null); // No sorting based on value

    const pieData = pieGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(0) // Standard pie, not donut
        .outerRadius(radius);

    const iconArcGenerator = d3.arc()
        .innerRadius(pieIconInnerRadius)
        .outerRadius(pieIconOuterRadius);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // No axes or gridlines for pie chart. Legend removed as per requirements.

    // Block 8: Main Data Visualization Rendering
    const sliceGroups = mainChartGroup.selectAll(".slice-group")
        .data(pieData)
        .join("g")
        .attr("class", "slice-group");

    sliceGroups.append("path")
        .attr("class", "mark pie-slice")
        .attr("d", arcGenerator)
        .attr("fill", d => (colorsInput.field && colorsInput.field[d.data[categoryFieldName]]) || fillStyle.defaultSliceColor)
        .attr("stroke", fillStyle.sliceStrokeColor)
        .attr("stroke-width", 2);

    // Add images if available
    sliceGroups.each(function(d, i) {
        const group = d3.select(this);
        const categoryValue = d.data[categoryFieldName];
        const imageUrl = imagesInput.field && imagesInput.field[categoryValue];

        if (imageUrl) {
            const clipId = `clip-pie-${containerSelector.replace(/[^a-zA-Z0-9]/g, '')}-${i}`;
            
            defs.append("clipPath")
                .attr("id", clipId)
                .append("path")
                .attr("d", iconArcGenerator(d)); // Use d directly for the path data

            group.append("image")
                .attr("class", "icon slice-icon")
                .attr("xlink:href", imageUrl)
                .attr("clip-path", `url(#${clipId})`)
                .attr("x", -pieIconOuterRadius) // Center image and make it large enough
                .attr("y", -pieIconOuterRadius)
                .attr("width", pieIconOuterRadius * 2)
                .attr("height", pieIconOuterRadius * 2)
                .attr("preserveAspectRatio", "xMidYMid slice"); // Cover the clip area
        }
    });
    
    // Add labels
    const minPercentageForLabel = variables.minPercentageForLabel !== undefined ? variables.minPercentageForLabel : 1; // Default min percentage to show label

    sliceGroups.each(function(d, i) {
        if (d.data.percentage < minPercentageForLabel) return;

        const sliceGroup = d3.select(this);
        const categoryText = String(d.data[categoryFieldName] || "");
        const percentageText = `${d.data.percentage.toFixed(1)}%`;
        
        const baseFontProps = {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight,
        };

        // Max width for labels, e.g., 30% of radius or a fixed value
        const maxLabelWidth = Math.min(radius * 0.6, variables.maxLabelWidth || 100);

        const fittedCategory = fitTextToWidth(categoryText, baseFontProps, maxLabelWidth, parseFloat(baseFontProps.fontSize) * 0.8);
        const fittedPercentage = fitTextToWidth(percentageText, { ...baseFontProps, fontSize: fittedCategory.fontProps.fontSize }, maxLabelWidth, parseFloat(baseFontProps.fontSize) * 0.8); // Use potentially reduced font size

        const categoryLabelHeight = estimateTextHeight(fittedCategory.fontProps);
        const percentageLabelHeight = estimateTextHeight(fittedPercentage.fontProps);
        
        const totalLabelHeight = categoryLabelHeight + (percentageText ? percentageLabelHeight + 5 : 0); // 5px spacing
        const maxActualTextWidth = Math.max(
            estimateTextWidth(fittedCategory.text, fittedCategory.fontProps),
            estimateTextWidth(fittedPercentage.text, fittedPercentage.fontProps)
        );

        const [iconCentroidX, iconCentroidY] = iconArcGenerator.centroid(d);
        const iconVisualEffectiveRadius = (pieIconOuterRadius - pieIconInnerRadius) / 2 + pieIconInnerRadius;


        const [labelX, labelY] = calculateLabelPosition(
            d,
            [iconCentroidX, iconCentroidY],
            iconVisualEffectiveRadius, // Effective radius of the icon area
            0, // Context inner radius (center of pie)
            radius, // Context outer radius (edge of pie slice)
            maxActualTextWidth,
            totalLabelHeight
        );

        const sliceColor = (colorsInput.field && colorsInput.field[d.data[categoryFieldName]]) || fillStyle.defaultSliceColor;
        const labelColor = getBrightness(sliceColor) < 135 ? '#FFFFFF' : fillStyle.textColor;

        if (fittedCategory.text) {
            sliceGroup.append("text")
                .attr("class", "label category-label")
                .attr("x", labelX)
                .attr("y", labelY - (fittedPercentage.text && percentageText ? (parseFloat(fittedCategory.fontProps.fontSize) * 0.7) : 0))
                .attr("text-anchor", "middle")
                .style("font-family", fittedCategory.fontProps.fontFamily)
                .style("font-size", fittedCategory.fontProps.fontSize)
                .style("font-weight", fittedCategory.fontProps.fontWeight)
                .style("fill", labelColor)
                .text(fittedCategory.text);
        }

        if (fittedPercentage.text && percentageText) {
            sliceGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", labelX)
                .attr("y", labelY + (fittedCategory.text ? (parseFloat(fittedPercentage.fontProps.fontSize) * 0.7) : 0))
                .attr("text-anchor", "middle")
                .style("font-family", fittedPercentage.fontProps.fontFamily)
                .style("font-size", fittedPercentage.fontProps.fontSize)
                .style("font-weight", fittedPercentage.fontProps.fontWeight)
                .style("fill", labelColor)
                .text(fittedPercentage.text);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No main title/subtitle as per requirements. Other enhancements could go here.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
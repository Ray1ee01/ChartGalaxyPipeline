/* REQUIREMENTS_BEGIN
{
  "chart_type": "Semicircle Pie Chart",
  "chart_name": "semicircle_pie_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
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
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear the container

    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme preference if both exist, or just colors
    const imagesInput = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xFieldColumn = dataColumns.find(col => col.role === 'x');
    const yFieldColumn = dataColumns.find(col => col.role === 'y');

    if (!xFieldColumn || !yFieldColumn) {
        const missing = [];
        if (!xFieldColumn) missing.push("x role");
        if (!yFieldColumn) missing.push("y role");
        const errorMsg = `Critical chart config missing: column(s) with ${missing.join(' and ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .html(errorMsg);
        return null;
    }

    const categoryFieldName = xFieldColumn.name;
    const valueFieldName = yFieldColumn.name;

    // Filter out data points with undefined/null crucial values early
    const chartDataArray = chartDataInput.filter(d => 
        d[categoryFieldName] != null && 
        d[valueFieldName] != null && 
        !isNaN(parseFloat(d[valueFieldName])) &&
        parseFloat(d[valueFieldName]) >= 0 // Values for pie should be non-negative
    );
    
    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points to render the chart after filtering.";
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "orange")
            .html(errorMsg);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        textColor: colorsInput.text_color || '#0f223b',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        primaryColor: (colorsInput.other && colorsInput.other.primary) || '#4682B4',
        defaultSliceColors: d3.schemeCategory10,
        getSliceColor: (category, index) => {
            if (colorsInput.field && colorsInput.field[category]) {
                return colorsInput.field[category];
            }
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                return colorsInput.available_colors[index % colorsInput.available_colors.length];
            }
            return fillStyle.defaultSliceColors[index % fillStyle.defaultSliceColors.length];
        }
    };

    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        if (!text) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but strict rules say not to append to DOM. For simple cases, this might work.
        // If not, a temporary append/remove to an off-screen part of the main SVG might be needed.
        // However, the prompt says "MUST NOT be appended to the document DOM".
        // For robustness, if getBBox on an unattached element is unreliable across browsers,
        // this might need a canvas-based fallback or a note about potential inaccuracies.
        // For now, adhering strictly.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on unattached elements
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
            return context.measureText(text).width;
        }
    };

    const getColorBrightness = (hexColor) => {
        if (!hexColor || hexColor.length < 4) return 0; // Default to dark if invalid
        hexColor = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
        if (hexColor.length === 3) {
            hexColor = hexColor.split('').map(char => char + char).join('');
        }
        const r = parseInt(hexColor.slice(0, 2), 16);
        const g = parseInt(hexColor.slice(2, 4), 16);
        const b = parseInt(hexColor.slice(4, 6), 16);
        return (r * 299 + g * 587 + b * 114) / 1000; // Standard brightness formula
    };

    const layoutLegend = (legendContainer, categories, options = {}) => {
        const opts = {
            maxWidth: 500, x: 0, y: 0, itemHeight: 20, itemSpacing: 10, // Reduced spacing
            rowSpacing: 10, symbolSize: 10, 
            align: "left", shape: "circle", ...options
        };
        
        const itemWidths = categories.map(cat => {
            const textWidth = estimateTextWidth(
                cat, 
                fillStyle.typography.labelFontFamily, 
                fillStyle.typography.labelFontSize, 
                fillStyle.typography.labelFontWeight
            );
            return opts.symbolSize * 1.5 + 5 + textWidth; // symbol + padding + text
        });
        
        const rows = [];
        let currentRow = [], currentRowWidth = 0;
        
        itemWidths.forEach((width, i) => {
            if (currentRow.length === 0 || currentRowWidth + width + opts.itemSpacing <= opts.maxWidth) {
                currentRow.push(i);
                currentRowWidth += width + (currentRow.length > 1 ? opts.itemSpacing : 0);
            } else {
                rows.push(currentRow);
                currentRow = [i];
                currentRowWidth = width;
            }
        });
        if (currentRow.length > 0) rows.push(currentRow);
        
        const totalHeight = rows.length * opts.itemHeight + (rows.length - 1) * opts.rowSpacing;
        const maxRowWidth = Math.max(0, ...rows.map(row => { // Ensure Math.max doesn't get -Infinity
            return row.reduce((sum, i, idx) => sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0), 0);
        }));
        
        rows.forEach((row, rowIndex) => {
            const rowWidth = row.reduce((sum, i, idx) => sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0), 0);
            let rowStartX = opts.x;
            if (opts.align === "center") {
                rowStartX = opts.x + (opts.maxWidth - rowWidth) / 2;
            } else if (opts.align === "right") {
                rowStartX = opts.x + opts.maxWidth - rowWidth;
            }
            
            let currentX = rowStartX;
            row.forEach(itemIndex => {
                const categoryName = categories[itemIndex];
                const color = fillStyle.getSliceColor(categoryName, itemIndex);
                const itemGroup = legendContainer.append("g")
                    .attr("class", "other") // As per VII, legend item group is 'other'
                    .attr("transform", `translate(${currentX}, ${opts.y + rowIndex * (opts.itemHeight + opts.rowSpacing)})`);
                
                if (opts.shape === "rect") {
                    itemGroup.append("rect")
                        .attr("x", 0).attr("y", (opts.itemHeight - opts.symbolSize) / 2)
                        .attr("width", opts.symbolSize).attr("height", opts.symbolSize)
                        .attr("fill", color)
                        .attr("class", "mark");
                } else { // Default to circle
                    itemGroup.append("circle")
                        .attr("cx", opts.symbolSize / 2).attr("cy", opts.itemHeight / 2)
                        .attr("r", opts.symbolSize / 2).attr("fill", color)
                        .attr("class", "mark");
                }
                
                itemGroup.append("text")
                    .attr("x", opts.symbolSize * 1.5)
                    .attr("y", opts.itemHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("fill", fillStyle.textColor)
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .attr("class", "label")
                    .text(categoryName);
                
                currentX += itemWidths[itemIndex] + opts.itemSpacing;
            });
        });
        
        return { width: maxRowWidth, height: totalHeight };
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 40, bottom: 20, left: 40 }; // Original margins
    
    // Semicircle specific layout
    const pieCenterX = containerWidth / 2;
    // Position Y for the base of the semicircle. Original logic: height - margin.bottom - 100
    // This means the semicircle is drawn "upwards" from this baseline.
    const pieCenterY = containerHeight - chartMargins.bottom - (variables.semicircleBaselineOffset || 50); // Made 100 configurable or a smaller default

    // Radius calculation:
    // Max radius based on width: (containerWidth - chartMargins.left - chartMargins.right) / 2
    // Max radius based on height available for semicircle: containerHeight - chartMargins.top - chartMargins.bottom - (variables.semicircleBaselineOffset || 50)
    // The smaller of these two determines the actual maxRadius.
    const availableWidthForPie = containerWidth - chartMargins.left - chartMargins.right;
    const availableHeightForPie = pieCenterY - chartMargins.top; // Height from top margin to pie baseline

    const outerRadius = Math.min(availableWidthForPie / 2, availableHeightForPie);
    
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other") // Main group for the pie
        .attr("transform", `translate(${pieCenterX}, ${pieCenterY})`);

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => parseFloat(d[valueFieldName]));
    const dataWithPercentages = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (parseFloat(d[valueFieldName]) / totalValue) * 100 : 0
    }));

    const legendCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];


    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => parseFloat(d[valueFieldName]))
        .sort(null) // Keep original data order
        .startAngle(-Math.PI / 2) // Start at the top
        .endAngle(Math.PI / 2);   // End at the bottom (180 degrees total)

    const arcPathGenerator = d3.arc()
        .innerRadius(0) // This makes it a pie, not a donut
        .outerRadius(outerRadius);
        // Removed .padAngle() and .cornerRadius() for simplification (V.2)

    const labelArcPathGenerator = d3.arc()
        .innerRadius(outerRadius * 0.65) // Position labels inside the slices
        .outerRadius(outerRadius * 0.65);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    if (variables.show_legend !== false && legendCategories.length > 0) { // Default to show legend
        const legendGroup = svgRoot.append("g")
            .attr("class", "other"); // Legend main group

        const legendSize = layoutLegend(legendGroup, legendCategories, {
            maxWidth: containerWidth - chartMargins.left - chartMargins.right,
            shape: variables.legend_shape || "rect", // e.g. "rect" or "circle"
            align: variables.legend_align || "center"
        });

        // Position legend: original was margin.top - 40. Let's use top margin.
        const legendX = (containerWidth - legendSize.width) / 2; // Centered
        const legendY = chartMargins.top / 2 - legendSize.height / 2; // Vertically centered in top margin area
        legendGroup.attr("transform", `translate(${legendX}, ${Math.max(10, legendY)})`); // Ensure not too high
    }

    // Block 8: Main Data Visualization Rendering
    const slicesGroup = mainChartGroup.append("g").attr("class", "mark-group");

    slicesGroup.selectAll("path.mark")
        .data(pieGenerator(dataWithPercentages))
        .enter()
        .append("path")
        .attr("class", "mark")
        .attr("fill", (d, i) => fillStyle.getSliceColor(d.data[categoryFieldName], i))
        .attr("d", arcPathGenerator);

    const labelsGroup = mainChartGroup.append("g").attr("class", "label-group");

    labelsGroup.selectAll("text.value")
        .data(pieGenerator(dataWithPercentages))
        .enter()
        .append("text")
        .attr("class", "value")
        .attr("transform", d => `translate(${labelArcPathGenerator.centroid(d)})`)
        .attr("text-anchor", "middle")
        .attr("dy", ".35em")
        .style("fill", d => {
            const sliceColor = fillStyle.getSliceColor(d.data[categoryFieldName], d.index);
            const brightness = getColorBrightness(sliceColor);
            return brightness > 128 ? '#000000' : '#FFFFFF'; // Contrast color for label
        })
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", "bold") // Make percentage labels bold as in original
        .text(d => (d.data.percentage >= (variables.min_percentage_for_label || 5)) ? `${d.data.percentage.toFixed(1)}%` : '');


    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects, gradients, shadows, etc.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
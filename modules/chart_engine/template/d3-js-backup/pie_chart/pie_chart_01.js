/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pie Chart",
  "chart_name": "pie_chart_01_d3",
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

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_edge"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // or data.colors_dark if theme logic was present
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");

    if (!xFieldConfig || !yFieldConfig) {
        const missing = [];
        if (!xFieldConfig) missing.push("category field (role 'x')");
        if (!yFieldConfig) missing.push("value field (role 'y')");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')} in dataColumns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;

    if (chartData.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.warn(errorMsg); // Use warn for data issues
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        textColor: colorsInput.text_color || '#0f223b',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        defaultSliceColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#1f77b4',
        sliceStrokeColor: '#FFFFFF',
        availableColors: colorsInput.available_colors || d3.schemeCategory10,
        getSliceColor: function(categoryName, index) {
            if (colorsInput.field && colorsInput.field[categoryName]) {
                return colorsInput.field[categoryName];
            }
            return this.availableColors[index % this.availableColors.length];
        },
        getImageUrl: function(categoryName) {
            if (imagesInput.field && imagesInput.field[categoryName]) {
                return imagesInput.field[categoryName];
            }
            return null;
        }
    };

    function estimateTextWidth(text, fontStyle) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('style', fontStyle); // e.g., "font-family: Arial; font-size: 12px;"
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append to DOM for getBBox for SVG elements
        return tempText.getBBox().width;
    }
    
    function splitTextIntoLines(text, maxLengthPerLine, fontStyle) {
        if (!text) return [""];
        const fullTextWidth = estimateTextWidth(text, fontStyle);
        // Estimate average char width. This is very rough.
        // A more robust approach would be to measure word by word.
        const avgCharWidth = fullTextWidth / (text.length || 1);
        const estimatedCharsPerLine = Math.floor(maxLengthPerLine / (avgCharWidth || 10));


        if (text.length <= estimatedCharsPerLine) return [text];
        
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';
        
        for (let word of words) {
            if (estimateTextWidth(currentLine + (currentLine ? ' ' : '') + word, fontStyle) <= maxLengthPerLine) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) lines.push(currentLine);
                // If a single word is longer than maxLengthPerLine, break it by char estimate
                if (estimateTextWidth(word, fontStyle) > maxLengthPerLine) {
                    let tempWord = word;
                    while(estimateTextWidth(tempWord, fontStyle) > maxLengthPerLine) {
                        let breakPoint = 0;
                        for(let k=1; k <= tempWord.length; k++){
                            if(estimateTextWidth(tempWord.substring(0, k), fontStyle) > maxLengthPerLine){
                                breakPoint = k-1;
                                break;
                            }
                            breakPoint = k;
                        }
                        lines.push(tempWord.substring(0, breakPoint));
                        tempWord = tempWord.substring(breakPoint);
                        if(tempWord.length === 0) break;
                    }
                    currentLine = tempWord;
                } else {
                    currentLine = word;
                }
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines.filter(line => line.trim() !== "");
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

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 40, left: 40 }; 
    const drawingWidth = containerWidth - chartMargins.left - chartMargins.right;
    const drawingHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    // Adjusted maxRadius to give more space for external labels/icons
    const maxRadius = Math.min(drawingWidth, drawingHeight) / 2 * 0.85; 

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartData, d => d[yFieldName]);
    const chartDataWithPercentages = chartData.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (Number(d[yFieldName]) / totalValue) * 100 : 0
    }));

    const pieGenerator = d3.pie()
        .value(d => d[yFieldName])
        .sort(null); 

    const pieSectors = pieGenerator(chartDataWithPercentages);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(0) 
        .outerRadius(maxRadius)
        .cornerRadius(5); 

    // Block 7: Chart Component Rendering 
    // No axes, gridlines, or legend for this pie chart.

    // Block 8: Main Data Visualization Rendering
    const sliceGroups = mainChartGroup.selectAll(".slice-group")
        .data(pieSectors)
        .enter()
        .append("g")
        .attr("class", (d,i) => `slice-group slice-group-${i}`);

    sliceGroups.append("path")
        .attr("d", arcGenerator)
        .attr("fill", (d, i) => fillStyle.getSliceColor(d.data[xFieldName], i))
        .attr("stroke", fillStyle.sliceStrokeColor)
        .attr("stroke-width", 2)
        .attr("class", "mark pie-slice");

    // Block 9: Optional Enhancements & Post-Processing (Labels, Icons)
    sliceGroups.each(function(d, i) {
        const sliceGroup = d3.select(this);
        const categoryName = d.data[xFieldName];
        const percentageValue = d.data.percentage;
        const rawValue = d.data[yFieldName];
        const imageUrl = fillStyle.getImageUrl(categoryName);

        const arcAngleDeg = (d.endAngle - d.startAngle) * (180 / Math.PI);
        
        const isLargeSlice = arcAngleDeg > 35; // Heuristic: slices > 35 degrees are "large"
        const iconDisplaySize = Math.max(15, Math.min(arcAngleDeg * 0.5, 30)); // Icon size based on angle, capped

        // Icon rendering
        if (imageUrl) {
            const iconId = `clip-${containerSelector.replace(/[^a-zA-Z0-9]/g, '')}-${i}`;
            const iconRadius = iconDisplaySize / 2;
            
            let iconCentroidActualRadius;
            if (isLargeSlice) { 
                iconCentroidActualRadius = maxRadius - iconRadius - 5; 
                if (iconCentroidActualRadius < maxRadius * 0.5) iconCentroidActualRadius = maxRadius * 0.5;
            } else { 
                iconCentroidActualRadius = maxRadius + iconRadius + 8; 
            }
            
            const iconArcDef = d3.arc().innerRadius(iconCentroidActualRadius).outerRadius(iconCentroidActualRadius);
            const [iconPositionCx, iconPositionCy] = iconArcDef.centroid(d);

            let defs = svgRoot.select("defs");
            if (defs.empty()) {
                defs = svgRoot.append("defs");
            }

            defs.append("clipPath")
                .attr("id", iconId)
                .append("circle")
                .attr("cx", 0) // Relative to icon group transform
                .attr("cy", 0)
                .attr("r", iconRadius);

            const iconGroup = sliceGroup.append("g")
                .attr("class", "icon-group")
                .attr("transform", `translate(${iconPositionCx}, ${iconPositionCy})`);

            iconGroup.append("circle")
                .attr("class", "icon-background other")
                .attr("r", iconRadius + 2) 
                .attr("fill", "white")
                .attr("stroke", fillStyle.getSliceColor(categoryName, i))
                .attr("stroke-width", 1);

            iconGroup.append("image")
                .attr("class", "icon image") 
                .attr("xlink:href", imageUrl)
                .attr("x", -iconRadius)
                .attr("y", -iconRadius)
                .attr("width", iconDisplaySize)
                .attr("height", iconDisplaySize)
                .attr("clip-path", `url(#${iconId})`);
        }

        // Text Label rendering
        const labelFontStyle = `font-family: ${fillStyle.typography.labelFontFamily}; font-size: ${fillStyle.typography.labelFontSize}; font-weight: ${fillStyle.typography.labelFontWeight};`;
        const annotationFontStyle = `font-family: ${fillStyle.typography.annotationFontFamily}; font-size: ${fillStyle.typography.annotationFontSize}; font-weight: ${fillStyle.typography.annotationFontWeight};`;
        
        // Max width for text block inside slice, or next to external icon
        const textBlockMaxWidth = isLargeSlice ? maxRadius * 0.5 : drawingWidth / pieSectors.length * 0.7;
        const categoryLines = splitTextIntoLines(categoryName, textBlockMaxWidth, labelFontStyle);
        
        let labelActualRadius;
        if (isLargeSlice) {
            labelActualRadius = maxRadius * 0.60; 
            if (imageUrl && (maxRadius - iconRadius - 5) < labelActualRadius + 20) {
                 labelActualRadius = (maxRadius - iconRadius - 5) - (iconDisplaySize/2) - 15; 
            }
        } else {
            labelActualRadius = maxRadius + iconDisplaySize + 15; 
        }
        if (labelActualRadius < 0 && pieSectors.length > 1) labelActualRadius = 10; // Prevent negative radius if possible
        else if (labelActualRadius < 0 && pieSectors.length === 1) labelActualRadius = maxRadius * 0.5;


        const labelArcDef = d3.arc().innerRadius(labelActualRadius).outerRadius(labelActualRadius);
        const [labelX, labelY] = labelArcDef.centroid(d);

        const textGroup = sliceGroup.append("g")
            .attr("class", "label-group")
            .attr("transform", `translate(${labelX}, ${labelY})`);

        let currentTextYOffset = 0; 
        const labelLineHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.2;
        const annotationLineHeight = parseFloat(fillStyle.typography.annotationFontSize) * 1.2;

        // Adjust starting Y to vertically center the text block if multiple lines
        const totalCategoryHeight = categoryLines.length * labelLineHeight;
        const hasPercentage = percentageValue >= 1;
        const totalBlockHeight = totalCategoryHeight + 
                                (hasPercentage ? labelLineHeight : 0) + 
                                annotationLineHeight;
        currentTextYOffset -= totalBlockHeight / 2 - labelLineHeight / 2;


        categoryLines.forEach((line, lineIndex) => {
            textGroup.append("text")
                .attr("class", "text label category-name")
                .attr("y", currentTextYOffset + (lineIndex * labelLineHeight))
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(line);
        });
        currentTextYOffset += totalCategoryHeight;
        currentTextYOffset += parseFloat(fillStyle.typography.labelFontSize) * 0.1; // Small gap

        if (hasPercentage) { 
            textGroup.append("text")
                .attr("class", "text label percentage-value")
                .attr("y", currentTextYOffset) 
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize) 
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(`${percentageValue.toFixed(1)}%`);
            currentTextYOffset += labelLineHeight;
        }

        textGroup.append("text")
            .attr("class", "text label raw-value")
            .attr("y", currentTextYOffset) 
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(rawValue.toLocaleString());
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
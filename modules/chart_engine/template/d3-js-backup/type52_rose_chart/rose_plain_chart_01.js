/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Rose Chart",
  "chart_name": "rose_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
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
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; 
    const images = data.images || {}; // Not used, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); 

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("category field (role: x)");
        if (!valueFieldName) missingFields.push("value field (role: y)");
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>Error: ${errorMsg}</div>`);
        return null;
    }
    
    const chartData = rawChartData.filter(d => 
        d[valueFieldName] != null && typeof d[valueFieldName] === 'number' && d[valueFieldName] >= 0 &&
        d[categoryFieldName] != null
    );
    if (chartData.length === 0) {
        const errorMsg = "No valid data available to render the chart after filtering.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: [...d3.schemeCategory10],
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };

    const fillStyle = {
        textColor: rawColors.text_color || defaultColors.text_color,
        chartBackground: rawColors.background_color || defaultColors.background_color,
        primaryColor: (rawColors.other && rawColors.other.primary) || defaultColors.other.primary,
        defaultCategoryColors: rawColors.available_colors && rawColors.available_colors.length > 0 ? rawColors.available_colors : defaultColors.available_colors,
        categoryFieldColors: rawColors.field || defaultColors.field,
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || defaultTypography.label.font_family,
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || defaultTypography.label.font_size,
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || defaultTypography.label.font_weight,
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || defaultTypography.annotation.font_family,
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || defaultTypography.annotation.font_size,
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || defaultTypography.annotation.font_weight,
        }
    };
    
    fillStyle.getCategoryColor = (category, index) => {
        if (fillStyle.categoryFieldColors && fillStyle.categoryFieldColors[category]) {
            return fillStyle.categoryFieldColors[category];
        }
        if (fillStyle.defaultCategoryColors && fillStyle.defaultCategoryColors.length > 0) {
            return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
        }
        return fillStyle.primaryColor; // Fallback to primary if no other color found
    };

    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        if (!text) return 0;
        // This utility uses an in-memory SVG and getBBox as per prompt.
        // Reliability of getBBox on non-DOM-appended elements can vary by browser/SVG implementation.
        // If it returns 0 or inaccurate values, legend layout may be affected.
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // To ensure getBBox works, it often needs to be in the DOM.
        // The prompt strictly forbids appending this temp SVG to the DOM.
        // We proceed assuming getBBox works on detached elements in the target environment.
        return textElement.getBBox().width;
    };
    
    const getContrastingTextColor = (hexColor) => {
        if (!hexColor || typeof hexColor !== 'string' || hexColor.length < 4) return fillStyle.textColor;
        let r, g, b;
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hexColor = hexColor.replace(shorthandRegex, (m, r1, g1, b1) => r1 + r1 + g1 + g1 + b1 + b1);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
        if (!result) return fillStyle.textColor;
        r = parseInt(result[1], 16);
        g = parseInt(result[2], 16);
        b = parseInt(result[3], 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128 ? '#000000' : '#FFFFFF';
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 500;
    const containerHeight = variables.height || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root other");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: 20, 
        right: 50, 
        bottom: 50, 
        left: 50 
    };
    
    const legendConfig = {
        itemSpacing: 15, 
        rowSpacing: 5,   
        iconSize: parseInt(fillStyle.typography.labelFontSize) * 0.8 || 10, // Relative to font size
        iconTextSpacing: 5,
        padding: 15 
    };
    legendConfig.maxWidth = containerWidth - (2 * legendConfig.padding);

    const uniqueCategories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    let legendLayout = { lines: [], height: 0, itemDetails: [] };

    if (variables.legendEnabled !== false && uniqueCategories.length > 0) {
        legendLayout.itemDetails = uniqueCategories.map((cat, i) => {
            const text = String(cat); // Ensure text is string
            const textWidth = estimateTextWidth(
                text, 
                fillStyle.typography.labelFontFamily, 
                fillStyle.typography.labelFontSize, 
                fillStyle.typography.labelFontWeight
            );
            return {
                label: text,
                color: fillStyle.getCategoryColor(cat, i),
                width: legendConfig.iconSize + legendConfig.iconTextSpacing + textWidth
            };
        });

        let currentLineWidth = 0;
        let currentLine = [];
        legendLayout.itemDetails.forEach(item => {
            if (currentLineWidth + item.width + (currentLine.length > 0 ? legendConfig.itemSpacing : 0) > legendConfig.maxWidth && currentLine.length > 0) {
                legendLayout.lines.push(currentLine);
                currentLine = [];
                currentLineWidth = 0;
            }
            currentLine.push(item);
            currentLineWidth += item.width + (currentLine.length > 1 ? legendConfig.itemSpacing : 0);
        });
        if (currentLine.length > 0) {
            legendLayout.lines.push(currentLine);
        }
        
        if (legendLayout.lines.length > 0) {
            const legendLabelActualHeight = parseInt(fillStyle.typography.labelFontSize);
            legendLayout.height = (legendLayout.lines.length * (legendLabelActualHeight + legendConfig.rowSpacing)) - legendConfig.rowSpacing + (2 * legendConfig.padding);
            chartMargins.top = legendLayout.height;
        }
    }

    const plotAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const plotAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const centerX = chartMargins.left + plotAreaWidth / 2;
    const centerY = chartMargins.top + plotAreaHeight / 2;

    const maxRadius = Math.max(0, Math.min(plotAreaWidth, plotAreaHeight) / 2); // Ensure non-negative
    const innerRadius = maxRadius * 0.15;

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartData, d => d[valueFieldName]);
    const chartDataWithPercentages = chartData.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0
    }));
    
    const maxValueInData = d3.max(chartData, d => d[valueFieldName]);


    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null) 
        .padAngle(0.02); 

    const arcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(d => {
            if (!maxValueInData || maxValueInData === 0) return innerRadius; 
            const ratio = d.data[valueFieldName] / maxValueInData;
            return innerRadius + (maxRadius - innerRadius) * ratio;
        });

    // Block 7: Chart Component Rendering (Legend)
    if (variables.legendEnabled !== false && legendLayout.lines && legendLayout.lines.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend other")
            .attr("transform", `translate(0, 0)`);

        const legendBlockTotalWidth = containerWidth; 
        const legendLabelActualHeight = parseInt(fillStyle.typography.labelFontSize);

        legendLayout.lines.forEach((lineItems, lineIndex) => {
            const totalLineWidth = lineItems.reduce((sum, item, i) => sum + item.width + (i > 0 ? legendConfig.itemSpacing : 0), 0);
            let lineStartX = (legendBlockTotalWidth - totalLineWidth) / 2;
            if (lineStartX < legendConfig.padding) lineStartX = legendConfig.padding;

            let itemX = lineStartX;
            const itemY = legendConfig.padding + (lineIndex * (legendLabelActualHeight + legendConfig.rowSpacing)) + (legendLabelActualHeight / 2); 

            lineItems.forEach(item => {
                const itemGroup = legendGroup.append("g")
                    .attr("transform", `translate(${itemX}, ${itemY})`)
                    .attr("class", "legend-item other");

                itemGroup.append("circle")
                    .attr("cx", legendConfig.iconSize / 2)
                    .attr("cy", 0) 
                    .attr("r", legendConfig.iconSize / 2)
                    .attr("fill", item.color)
                    .attr("class", "mark legend-mark");

                itemGroup.append("text")
                    .attr("x", legendConfig.iconSize + legendConfig.iconTextSpacing)
                    .attr("y", 0) 
                    .attr("dominant-baseline", "middle")
                    .attr("fill", fillStyle.textColor)
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .attr("class", "label legend-label")
                    .text(item.label);
                
                itemX += item.width + legendConfig.itemSpacing;
            });
        });
    }

    // Block 8: Main Data Visualization Rendering
    const chartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "chart-core-group other");

    if (maxRadius > 0 && plotAreaHeight > 0 && plotAreaWidth > 0) { // Only render if space available
        chartGroup.selectAll("path.segment-mark")
            .data(pieGenerator(chartDataWithPercentages))
            .enter()
            .append("path")
            .attr("class", "mark segment-mark")
            .attr("fill", (d, i) => fillStyle.getCategoryColor(d.data[categoryFieldName], i))
            .attr("d", arcGenerator);

        chartGroup.selectAll("text.data-label")
            .data(pieGenerator(chartDataWithPercentages))
            .enter()
            .append("text")
            .attr("class", "value data-label")
            .attr("transform", d => {
                if (!maxValueInData || maxValueInData === 0) return `translate(0,0)`;
                const segmentValue = d.data[valueFieldName];
                if (segmentValue === 0) return `translate(0,0)`; // Don't label zero-value segments this way

                const midAngle = (d.startAngle + d.endAngle) / 2;
                const segmentOuterRadius = innerRadius + (maxRadius - innerRadius) * (segmentValue / maxValueInData);
                const labelRadius = innerRadius + (segmentOuterRadius - innerRadius) * 0.7; 
                const x = Math.sin(midAngle) * labelRadius;
                const y = -Math.cos(midAngle) * labelRadius;
                return `translate(${x}, ${y})`;
            })
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", (d, i) => {
                const segmentColor = fillStyle.getCategoryColor(d.data[categoryFieldName], i);
                return getContrastingTextColor(segmentColor);
            })
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .text(d => {
                return d.data.percentage >= 5 ? `${d.data.percentage.toFixed(1)}%` : '';
            });
    } else {
         chartGroup.append("text")
            .attr("class", "label error-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .text("Not enough space to render chart.");
    }


    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pyramid Diagram",
  "chart_name": "pyramid_diagram_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 10], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 300,
  "min_width": 300,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // or data.colors_dark for dark themes
    const imagesConfig = data.images || {}; // Parsed for completeness, not used in this chart's core visuals
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !categoryColumn.name) {
        const errorMsg = "Critical chart config missing: Category field name (role 'x'). Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        const errorMsg = "Critical chart config missing: Value field name (role 'y'). Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    if (chartDataInput.length === 0) {
        const infoMsg = "No data provided to chart.";
        console.warn(infoMsg);
        d3.select(containerSelector).html(`<div style='text-align:center; padding:20px;'>${infoMsg}</div>`);
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) || '16px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal', // Default to normal, original code used bold implicitly
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        pyramidSegmentValueLabelColor: (colorsConfig.other && colorsConfig.other.valueLabelOnShape) || '#FFFFFF',
        defaultCategoryColors: d3.schemeCategory10, // Fallback color scheme
    };

    fillStyle.getCategoryColor = (categoryValue, index) => {
        if (colorsConfig.field && colorsConfig.field[categoryValue]) {
            return colorsConfig.field[categoryValue];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
    };
    
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        // This function is a placeholder as per requirements, not critically used for layout in this chart.
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-weight', fontWeight || fillStyle.typography.labelFontWeight);
        textEl.setAttribute('font-size', fontSize || fillStyle.typography.labelFontSize);
        textEl.setAttribute('font-family', fontFamily || fillStyle.typography.labelFontFamily);
        textEl.textContent = text;
        svg.appendChild(textEl);
        try {
            return textEl.getBBox().width;
        } catch (e) {
            return (text ? String(text).length : 0) * (parseInt(fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: (variables.margins && variables.margins.top !== undefined) ? variables.margins.top : 40,
        right: (variables.margins && variables.margins.right !== undefined) ? variables.margins.right : 60,
        bottom: (variables.margins && variables.margins.bottom !== undefined) ? variables.margins.bottom : 40,
        left: (variables.margins && variables.margins.left !== undefined) ? variables.margins.left : 120, // Accommodate category labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <=0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Adjust container size or margins.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const pyramidMaxWidthFactor = variables.pyramidMaxWidthFactor || 0.7;
    const pyramidMaxHeightFactor = variables.pyramidMaxHeightFactor || 0.9;

    const maxPyramidWidth = innerWidth * pyramidMaxWidthFactor;
    const pyramidHeight = innerHeight * pyramidMaxHeightFactor;

    // Block 5: Data Preprocessing & Transformation
    // Deep copy for manipulation, filter for valid positive values essential for pyramid math
    const validChartData = JSON.parse(JSON.stringify(chartDataInput))
        .filter(d => typeof d[valueFieldName] === 'number' && d[valueFieldName] > 0);

    if (validChartData.length === 0) {
        const infoMsg = "No valid data (positive numerical values) available for pyramid chart.";
        console.warn(infoMsg);
        d3.select(containerSelector).html(`<div style='text-align:center; padding:20px;'>${infoMsg}</div>`);
        return null;
    }
    
    validChartData.sort((a, b) => a[valueFieldName] - b[valueFieldName]); // Smallest value at the top

    const totalValue = d3.sum(validChartData, d => d[valueFieldName]);
    if (totalValue <= 0) { // Should be caught by filter, but as a safeguard
        const errorMsg = "Total sum of values is not positive. Cannot render pyramid.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }


    const sections = [];
    let currentHeightFromApex = 0; 
    const totalPyramidArea = (maxPyramidWidth * pyramidHeight) / 2;

    validChartData.forEach(d => {
        const sectionValue = d[valueFieldName];
        const sectionAreaProportion = sectionValue / totalValue;
        const sectionTargetArea = totalPyramidArea * sectionAreaProportion;

        const coeffA = maxPyramidWidth / (2 * pyramidHeight);
        const coeffB = (maxPyramidWidth * currentHeightFromApex) / pyramidHeight;
        const coeffC = -sectionTargetArea;

        let h; 
        if (Math.abs(coeffA) < 1e-9) { // Effectively A is zero (e.g. pyramidHeight is infinite or maxPyramidWidth is zero)
            h = (Math.abs(coeffB) < 1e-9) ? 0 : -coeffC / coeffB;
        } else {
            const discriminant = coeffB * coeffB - 4 * coeffA * coeffC;
            if (discriminant < 0) { // Fallback if no real solution (e.g. due to float issues or extreme data)
                h = (sectionValue / totalValue) * pyramidHeight; // Height proportional to value
            } else {
                h = (-coeffB + Math.sqrt(discriminant)) / (2 * coeffA);
            }
        }
        
        h = Math.max(0, h); // Ensure h is non-negative
        if (!isFinite(h)) h = 0; // Ensure h is finite

        const segmentTopWidth = (maxPyramidWidth * currentHeightFromApex) / pyramidHeight;
        const segmentBottomYFromApex = currentHeightFromApex + h;
        const segmentBottomWidth = (maxPyramidWidth * segmentBottomYFromApex) / pyramidHeight;
        
        sections.push({
            data: d,
            yApex: currentHeightFromApex, 
            h: h,                       
            widthApex: segmentTopWidth,     
            widthBase: segmentBottomWidth,    
        });
        currentHeightFromApex += h;
    });
    
    const calculatedPyramidHeight = Math.max(0, currentHeightFromApex); 
    const verticalOffset = (innerHeight - calculatedPyramidHeight) / 2;

    // Block 6: Scale Definition & Configuration (Implicit)
    // No explicit D3 scales for pyramid geometry.

    // Block 7: Chart Component Rendering 
    // No axes, gridlines, legend for this chart type.

    // Block 8: Main Data Visualization Rendering
    const pyramidSegmentsGroup = mainChartGroup.append("g").attr("class", "pyramid-segments");
    const xCenter = innerWidth / 2;

    sections.forEach((section, i) => {
        const d = section.data;
        const color = fillStyle.getCategoryColor(d[categoryFieldName], i);

        const y1 = section.yApex + verticalOffset; 
        const y2 = section.yApex + section.h + verticalOffset;

        // Ensure widths are non-negative
        const wApex = Math.max(0, section.widthApex);
        const wBase = Math.max(0, section.widthBase);

        const points = [
            [xCenter - wApex / 2, y1],
            [xCenter + wApex / 2, y1],
            [xCenter + wBase / 2, y2],
            [xCenter - wBase / 2, y2]
        ];

        pyramidSegmentsGroup.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", color)
            .attr("class", "mark pyramid-segment");

        const segmentCenterY = y1 + section.h / 2;

        pyramidSegmentsGroup.append("text")
            .attr("x", xCenter)
            .attr("y", segmentCenterY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight) // Use configured/default weight
            .attr("fill", fillStyle.pyramidSegmentValueLabelColor)
            .attr("class", "label value")
            .text(d[valueFieldName]);
            
        const categoryLabelX = xCenter - Math.max(wApex, wBase) / 2 - 10; 
        
        pyramidSegmentsGroup.append("text")
            .attr("x", categoryLabelX)
            .attr("y", segmentCenterY)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .attr("class", "label category")
            .text(d[categoryFieldName]);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
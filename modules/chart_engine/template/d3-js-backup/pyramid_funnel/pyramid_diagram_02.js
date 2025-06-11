/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Pyramid Diagram",
  "chart_name": "pyramid_diagram_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 10], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
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
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !categoryColumn.name) {
        console.error("Critical chart config missing: Category field (role 'x') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (Category field name).</div>");
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Value field (role 'y') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (Value field name).</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    if (chartDataInput.length === 0) {
        // Optionally render a message, or just leave blank as per clearing.
        // d3.select(containerSelector).html("<div style='color:grey; padding:10px;'>No data to display.</div>");
        return null; 
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color || '#0F223B',
        backgroundColor: colors.background_color || '#FFFFFF',
        getSegmentColor: (categoryValue, index) => {
            if (colors.field && colors.field[categoryValue]) {
                return colors.field[categoryValue];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            const defaultColorScale = d3.scaleOrdinal(d3.schemeCategory10);
            return defaultColorScale(index.toString());
        },
        segmentStrokeColor: '#333333',
        categoryLabelColor: '#FFFFFF', 
        valueLabelColor: colors.text_color || '#0F223B',
        labelBackgroundFill: 'rgba(0, 0, 0, 0.4)',
        typography: {
            categoryLabel: {
                font_family: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
                font_size: (typography.label && typography.label.font_size) || '14px',
                font_weight: (typography.label && typography.label.font_weight) || 'bold',
            },
            valueLabel: {
                font_family: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
                font_size: (typography.annotation && typography.annotation.font_size) || '12px',
                font_weight: (typography.annotation && typography.annotation.font_weight) || 'bold',
            }
        }
    };

    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const textNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textNode.setAttribute("font-family", fontFamily);
        textNode.setAttribute("font-size", fontSize);
        textNode.setAttribute("font-weight", fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // Assumes an environment where getBBox works on detached elements or this is best-effort.
        // For strict "MUST NOT be appended to the document DOM", getBBox on detached elements is the only option.
        return textNode.getBBox().width;
    }
    
    const segmentGap = 2; // Constant gap between pyramid segments

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

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 120, bottom: 20, left: 60 }; 
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const basePyramidMaxWidth = innerWidth * 0.7; 
    const basePyramidHeight = innerHeight * 0.8; 

    // Block 5: Data Preprocessing & Transformation
    const sortedChartData = [...chartDataInput]
        .filter(d => typeof d[valueFieldName] === 'number' && d[valueFieldName] >= 0 && d[categoryFieldName] != null)
        .sort((a, b) => a[valueFieldName] - b[valueFieldName]); 

    if (sortedChartData.length === 0) {
        // d3.select(containerSelector).html("<div style='color:grey; padding:10px;'>No valid data to display after filtering.</div>");
        return svgRoot.node(); 
    }
    
    const totalValue = d3.sum(sortedChartData, d => d[valueFieldName]);

    if (totalValue === 0) {
        // d3.select(containerSelector).html("<div style='color:grey; padding:10px;'>Total value of data is 0, cannot render proportional pyramid.</div>");
        // Render labels if categories exist but all values are 0? For now, return minimal SVG.
        return svgRoot.node();
    }

    let cumulativePercent = 0;
    const processedChartData = sortedChartData.map(d => {
        const percent = (d[valueFieldName] / totalValue) * 100;
        const item = {
            ...d,
            percent: percent,
            cumulativePercentStart: cumulativePercent,
        };
        cumulativePercent += percent;
        item.cumulativePercentEnd = cumulativePercent;
        return item;
    });

    const totalArea = basePyramidMaxWidth * basePyramidHeight / 2; 
    let currentPyramidHeightTracker = 0; 
    
    const pyramidSections = [];
    processedChartData.forEach(d => {
        const areaRatio = d.percent / 100;
        const sectionArea = totalArea * areaRatio;

        const bottomWidthAtCurrentLevel = basePyramidMaxWidth * (currentPyramidHeightTracker / basePyramidHeight);

        const a_quad = basePyramidMaxWidth / (2 * basePyramidHeight);
        const b_quad = bottomWidthAtCurrentLevel; 
        const c_quad = -sectionArea; 
        
        let h_segment;
        const discriminant = b_quad * b_quad - 4 * a_quad * c_quad;

        if (discriminant < 0 || a_quad === 0) { // Check for non-real solution or division by zero
             h_segment = 0; // Assign zero height if calculation fails
        } else {
            h_segment = (-b_quad + Math.sqrt(discriminant)) / (2 * a_quad);
        }
        
        if (isNaN(h_segment) || h_segment < 0) { // Check for invalid height
            h_segment = 0; // Default to zero height for problematic segments
        }

        const topWidthAtCurrentLevel = basePyramidMaxWidth * ((currentPyramidHeightTracker + h_segment) / basePyramidHeight);

        pyramidSections.push({
            data: d,
            bottomY: currentPyramidHeightTracker, 
            topY: currentPyramidHeightTracker + h_segment, 
            bottomWidth: bottomWidthAtCurrentLevel,
            topWidth: topWidthAtCurrentLevel,
            h_segment: h_segment // Store segment height for checks
        });
        currentPyramidHeightTracker += h_segment;
    });
    
    const actualCalculatedPyramidHeight = currentPyramidHeightTracker > 0 ? currentPyramidHeightTracker : basePyramidHeight; // Avoid division by zero if all h_segment are 0
    
    const totalHeightWithGaps = actualCalculatedPyramidHeight + (pyramidSections.filter(s => s.h_segment > 0).length > 0 ? (pyramidSections.filter(s => s.h_segment > 0).length -1) * segmentGap : 0);
    const verticalOffset = (innerHeight - totalHeightWithGaps) / 2;

    // Block 6: Scale Definition & Configuration
    // Not applicable for this chart.

    // Block 7: Chart Component Rendering
    // Not applicable for this chart.

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 8: Main Data Visualization Rendering
    let accumulatedOffsetY = verticalOffset; 

    pyramidSections.forEach((section, i) => {
        if (section.h_segment <= 0) return; // Skip rendering zero-height segments

        const d = section.data;
        const segmentColor = fillStyle.getSegmentColor(d[categoryFieldName], i);
        
        const points = [
            [innerWidth / 2 - section.bottomWidth / 2, accumulatedOffsetY + section.bottomY],
            [innerWidth / 2 + section.bottomWidth / 2, accumulatedOffsetY + section.bottomY],
            [innerWidth / 2 + section.topWidth / 2, accumulatedOffsetY + section.topY],      
            [innerWidth / 2 - section.topWidth / 2, accumulatedOffsetY + section.topY]       
        ];

        mainChartGroup.append("polygon")
            .attr("class", "mark pyramid-segment")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", segmentColor)
            .attr("stroke", fillStyle.segmentStrokeColor)
            .attr("stroke-width", 0.5);

        const segmentCenterY = accumulatedOffsetY + (section.bottomY + section.topY) / 2;
        const segmentAverageWidth = (section.bottomWidth + section.topWidth) / 2;

        const categoryLabelText = String(d[categoryFieldName]); // Ensure text is string
        if (segmentAverageWidth > 5 && categoryLabelText.trim() !== "") { 
            const categoryLabelWidth = estimateTextWidth(
                categoryLabelText,
                fillStyle.typography.categoryLabel.font_weight,
                fillStyle.typography.categoryLabel.font_size,
                fillStyle.typography.categoryLabel.font_family
            );
            const labelFontSize = parseFloat(fillStyle.typography.categoryLabel.font_size);

            if (categoryLabelWidth + 10 > segmentAverageWidth) { 
                 mainChartGroup.append("rect")
                    .attr("class", "label-background")
                    .attr("x", innerWidth / 2 - (categoryLabelWidth + 10) / 2)
                    .attr("y", segmentCenterY - (labelFontSize * 0.75)) 
                    .attr("width", categoryLabelWidth + 10)
                    .attr("height", labelFontSize * 1.5) 
                    .attr("fill", fillStyle.labelBackgroundFill)
                    .attr("rx", 3)
                    .attr("ry", 3);
            }

            mainChartGroup.append("text")
                .attr("class", "label category-label")
                .attr("x", innerWidth / 2)
                .attr("y", segmentCenterY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.categoryLabel.font_family)
                .style("font-size", fillStyle.typography.categoryLabel.font_size)
                .style("font-weight", fillStyle.typography.categoryLabel.font_weight)
                .style("fill", fillStyle.categoryLabelColor)
                .text(categoryLabelText);
        }

        const valueLabelText = `${d[valueFieldName]} (${d.percent.toFixed(1)}%)`;
        if (valueLabelText.trim() !== "") {
            mainChartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", innerWidth / 2 + basePyramidMaxWidth / 2 + 10) 
                .attr("y", segmentCenterY)
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.valueLabel.font_family)
                .style("font-size", fillStyle.typography.valueLabel.font_size)
                .style("font-weight", fillStyle.typography.valueLabel.font_weight)
                .style("fill", fillStyle.valueLabelColor)
                .text(valueLabelText);
        }
        
        if (i < pyramidSections.length - 1 && pyramidSections[i+1].h_segment > 0) { // Add gap only if next segment is also rendered
            accumulatedOffsetY += segmentGap;
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
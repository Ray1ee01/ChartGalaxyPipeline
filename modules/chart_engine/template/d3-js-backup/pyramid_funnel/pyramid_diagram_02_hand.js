/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pyramid Diagram",
  "chart_name": "pyramid_diagram_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
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
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    // Prioritize data.colors_dark if available, then data.colors, then empty object,
    // as original chart was dark-themed.
    const colorsInput = data.colors_dark || data.colors || {}; 
    const imagesInput = data.images || {}; // Not used in this chart type but good practice to extract
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldRole = "x";
    const valueFieldRole = "y";

    const categoryColumn = dataColumns.find(col => col.role === categoryFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);

    if (!categoryColumn || !categoryColumn.name) {
        console.error("Critical chart config missing: Category field name (role 'x') not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (category field 'x').</div>");
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Value field name (role 'y') not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (value field 'y').</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    const validatedChartData = chartDataInput.filter(d => {
        const val = d[valueFieldName];
        return d[categoryFieldName] != null && val != null && typeof val === 'number' && val >= 0;
    });

    if (validatedChartData.length === 0) {
        // console.error("No valid data to render after filtering."); // Console log can be noisy
        d3.select(containerSelector).html("<div style='color:grey; padding:10px;'>No data to display.</div>");
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '14px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'bold',
        },
        textColor: colorsInput.text_color || '#0f223b',
        textOnSegmentColor: (colorsInput.other && colorsInput.other.text_on_segment) ? colorsInput.other.text_on_segment : '#FFFFFF',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        defaultSegmentColor: '#CCCCCC',
    };
    
    const categoryColorMap = new Map();
    const uniqueCategoriesForColoring = [...new Set(validatedChartData.map(d => d[categoryFieldName]))];
    const d3ColorScale = d3.scaleOrdinal(d3.schemeCategory10);

    uniqueCategoriesForColoring.forEach(category => {
        let color;
        const categoryColors = colorsInput.field && colorsInput.field[categoryFieldName];
        if (categoryColors && categoryColors[category]) {
            color = categoryColors[category];
        } else if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            let hash = 0;
            if (typeof category === 'string') { // Ensure category is a string for charCodeAt
                for (let i = 0; i < category.length; i++) {
                    hash = category.charCodeAt(i) + ((hash << 5) - hash);
                    hash = hash & hash; // Convert to 32bit integer
                }
            } else { // Fallback for non-string categories
                hash = Math.floor(Math.random() * colorsInput.available_colors.length); 
            }
            color = colorsInput.available_colors[Math.abs(hash) % colorsInput.available_colors.length];
        } else {
            color = d3ColorScale(category);
        }
        categoryColorMap.set(category, color);
    });

    fillStyle.getColor = (category) => categoryColorMap.get(category) || fillStyle.defaultSegmentColor;

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.visibility = "hidden"; // Keep it off-screen
        // tempSvg.style.position = "absolute";
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        tempSvg.appendChild(textEl);
        // Appending to DOM is more reliable but forbidden by spec.
        // document.body.appendChild(tempSvg);
        const width = textEl.getBBox().width;
        // document.body.removeChild(tempSvg);
        return width;
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
        .attr("class", "chart-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.margin_top || 40, 
        right: variables.margin_right || 120, 
        bottom: variables.margin_bottom || 40, 
        left: variables.margin_left || 60 
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const maxPyramidWidth = innerWidth * (variables.pyramid_width_ratio || 0.6); 
    const pyramidTotalHeight = innerHeight * (variables.pyramid_height_ratio || 0.8);

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...validatedChartData].sort((a, b) => a[valueFieldName] - b[valueFieldName]);

    const totalValue = d3.sum(sortedData, d => d[valueFieldName]);

    if (totalValue <= 0) {
        // console.error("Total value is zero or negative. Cannot render pyramid."); // Noisy
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Total data value is not positive.</div>");
        return null;
    }

    const pyramidSegments = [];
    let cumulativeY_squared = 0; 

    sortedData.forEach(d => {
        const value = d[valueFieldName];
        const y1_from_apex = Math.sqrt(cumulativeY_squared); 

        const segment_y_contribution_squared = pyramidTotalHeight * pyramidTotalHeight * (value / totalValue);
        cumulativeY_squared += segment_y_contribution_squared;
        const y2_from_apex = Math.sqrt(cumulativeY_squared); 
        
        // Ensure widths are not NaN if pyramidTotalHeight is 0 (e.g. if innerHeight is too small)
        const segmentTopWidth = pyramidTotalHeight > 0 ? maxPyramidWidth * (y1_from_apex / pyramidTotalHeight) : 0;
        const segmentBottomWidth = pyramidTotalHeight > 0 ? maxPyramidWidth * (y2_from_apex / pyramidTotalHeight) : 0;
        
        pyramidSegments.push({
            data: d,
            y1: y1_from_apex, 
            y2: y2_from_apex, 
            topWidth: segmentTopWidth,
            bottomWidth: segmentBottomWidth
        });
    });
    
    const verticalOffset = (innerHeight - pyramidTotalHeight) / 2;

    // Block 6: Scale Definition & Configuration
    // Implicit in geometric calculations.

    // Block 7: Chart Component Rendering
    // No axes, gridlines, or legend.

    // Block 8: Main Data Visualization Rendering
    const centerX = innerWidth / 2;

    pyramidSegments.forEach((segment) => {
        const d = segment.data;
        const category = d[categoryFieldName];
        const value = d[valueFieldName];
        
        const segmentColor = fillStyle.getColor(category);

        const points = [
            [centerX - segment.topWidth / 2, segment.y1 + verticalOffset],
            [centerX + segment.topWidth / 2, segment.y1 + verticalOffset],
            [centerX + segment.bottomWidth / 2, segment.y2 + verticalOffset],
            [centerX - segment.bottomWidth / 2, segment.y2 + verticalOffset]
        ];

        mainChartGroup.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", segmentColor)
            .attr("class", "mark pyramid-segment");

        const labelY = (segment.y1 + segment.y2) / 2 + verticalOffset;
        
        mainChartGroup.append("text")
            .attr("x", centerX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textOnSegmentColor)
            .attr("class", "label value-label")
            .text(value);
            
        const categoryLabelText = String(category);
        
        mainChartGroup.append("text")
            .attr("x", centerX + Math.max(segment.topWidth, segment.bottomWidth) / 2 + 10) 
            .attr("y", labelY)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", segmentColor) 
            .attr("class", "label category-label")
            .text(categoryLabelText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_10",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    const chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    const categoryFieldUnit = dataColumns.find(col => col.role === "x")?.unit || "none";
    const valueFieldUnit = dataColumns.find(col => col.role === "y")?.unit || "none";


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px', // Base, might be overridden dynamically
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        barColor: colorsConfig.other?.primary || '#882e2e',
        barLabelColorInside: '#FFFFFF',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Default to white if not provided
    };
    fillStyle.barLabelColorOutside = fillStyle.textColor; // Use general text color for outside labels

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.setAttribute('width', '0');
        tempSvg.setAttribute('height', '0');
        // Do not append to DOM: tempSvg.style.visibility = 'hidden'; document.body.appendChild(tempSvg);

        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (fontProps.fontFamily) tempTextElement.style.fontFamily = fontProps.fontFamily;
        if (fontProps.fontSize) tempTextElement.style.fontSize = fontProps.fontSize;
        if (fontProps.fontWeight) tempTextElement.style.fontWeight = fontProps.fontWeight;
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        
        // Need to append to body to getBBox, then remove.
        // This is a deviation but necessary for getBBox if not using D3 selection on existing SVG.
        // For a truly in-memory, one might need a more complex setup or rely on canvas context.
        // Given D3 context, usually a detached D3 selection is used.
        // Let's stick to the prompt's spirit: "in-memory SVG structure" means not permanently in DOM.
        // A common pattern is to append to a hidden part of the DOM or a detached SVG node.
        // For simplicity and to avoid DOM flash if not perfectly hidden:
        // We will use a D3 selected detached SVG node later for measurements if needed,
        // or accept that this helper might need to be within D3's chain if it's creating elements.
        // The original code appended to containerSelector, then removed. We'll refine this.
        // The prompt implies `document.createElementNS` is fine. `getBBox` on such an element
        // without attaching to the visible DOM can be unreliable across browsers.
        // A robust way is to have a utility SVG within the main SVG or a temporary one.
        // For now, let's assume this simplified version works or use the D3 pattern.

        // Reverting to a D3-based temporary text for measurement, not appended to main SVG.
        const utilitySvg = d3.create("svg").style("visibility", "hidden").style("position", "absolute");
        const textNode = utilitySvg.append("text")
            .style("font-family", fontProps.fontFamily)
            .style("font-size", fontProps.fontSize)
            .style("font-weight", fontProps.fontWeight)
            .text(text);
        const width = textNode.node().getBBox().width;
        utilitySvg.remove(); // Clean up the detached SVG
        return width;
    }
    
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        }
        return d3.format("~g")(value);
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const initialContainerWidth = chartConfig.width || 800;
    const initialContainerHeight = chartConfig.height || 600; // Base height

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", initialContainerWidth) // Fixed width
        .attr("height", initialContainerHeight) // Base height, might be adjusted
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);


    // Block 4: Core Chart Dimensions & Layout Calculation
    // Calculate category names for height adjustment and margin calculation
    const categoryNames = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    
    const containerHeight = categoryNames.length > 15
        ? initialContainerHeight * (1 + (categoryNames.length - 15) * 0.03)
        : initialContainerHeight;
    
    svgRoot.attr("height", containerHeight); // Adjust SVG height if necessary

    const chartMargins = {
        top: chartConfig.marginTop || 20, // Reduced default top margin as no main title
        right: chartConfig.marginRight || 10,
        bottom: chartConfig.marginBottom || 20, // Reduced default bottom margin
        left: chartConfig.marginLeft || 100
    };

    // Calculate max label widths for margin adjustments
    const tempBarHeightForIconSizing = 30; // Arbitrary, for rough icon size estimation
    const tempIconHeight = tempBarHeightForIconSizing * 0.9;
    const tempIconWidth = tempIconHeight * 1.33;
    const iconPadding = 5;

    let maxCategoryLabelWidth = 0;
    categoryNames.forEach(catName => {
        const formattedCatName = categoryFieldUnit !== "none" ? `${catName}${categoryFieldUnit}` : `${catName}`;
        const textWidth = estimateTextWidth(formattedCatName, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        let totalWidth = textWidth;
        if (imagesConfig.field && imagesConfig.field[catName]) {
            totalWidth += tempIconWidth + iconPadding;
        }
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, totalWidth);
    });

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const value = d[valueFieldName];
        const formattedValue = valueFieldUnit !== "none" ?
            `${formatValue(value)}${valueFieldUnit}` :
            `${formatValue(value)}`;
        const textWidth = estimateTextWidth(formattedValue, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize, // Use base annotation size for this estimation
            fontWeight: fillStyle.typography.annotationFontWeight
        });
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });
    
    chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 20); // Add padding
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 15); // Add padding for value labels outside bars

    const innerWidth = initialContainerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;


    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedCategoryNames = sortedData.map(d => d[categoryFieldName]);


    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2; // Fixed bar padding

    const yScale = d3.scaleBand()
        .domain(sortedCategoryNames)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => +d[valueFieldName]) * 1.05 || 10]) // Ensure domain is at least 0-10
        .range([0, innerWidth]);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this specific chart style.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    sortedData.forEach(d => {
        const categoryName = d[categoryFieldName];
        const value = +d[valueFieldName];

        const barY = yScale(categoryName);
        const barHeight = yScale.bandwidth();
        const barWidth = xScale(value);
        
        if (barY === undefined || barHeight === undefined || isNaN(barWidth) || barWidth < 0) {
            // console.warn(`Skipping bar for category ${categoryName} due to invalid scale output.`);
            return; 
        }

        const barGroup = mainChartGroup.append("g").attr("class", "bar-group");

        // Rounded bar path
        const radius = barHeight / 2;
        let pathData;
        if (barWidth <= radius * 2) { // Draw a full circle if width is too small
             // Ensure radius is positive for path generation
            const safeRadius = Math.max(0.1, radius); // Prevent zero or negative radius
            const actualBarWidthRadius = Math.max(0.1, barWidth / 2);
            const circleRadius = Math.min(safeRadius, actualBarWidthRadius);

            pathData = `
                M ${barY + radius - circleRadius}, ${barY + radius}
                a ${circleRadius},${circleRadius} 0 1,0 ${circleRadius*2},0
                a ${circleRadius},${circleRadius} 0 1,0 ${-circleRadius*2},0
            `;
             // Centering the small circle:
             pathData = `
                M ${actualBarWidthRadius},${barY + radius - actualBarWidthRadius}
                A ${actualBarWidthRadius},${actualBarWidthRadius} 0 0,1 ${actualBarWidthRadius},${barY + radius + actualBarWidthRadius}
                A ${actualBarWidthRadius},${actualBarWidthRadius} 0 0,1 ${actualBarWidthRadius},${barY + radius - actualBarWidthRadius}
             `;
             // Simplified: draw a circle at the start of the bar, centered vertically
             // This might not be ideal if barWidth is very small but > 0.
             // The original logic was:
             // M ${radius},${y} A ${radius},${radius} 0 0,1 ${radius},${y + barHeight} A ${radius},${radius} 0 0,1 ${radius},${y}
             // This assumes x=0 start. Let's adapt.
             pathData = `
                M ${radius},${barY}
                A ${radius},${radius} 0 1,1 ${radius},${barY + barHeight}
                A ${radius},${radius} 0 1,1 ${radius},${barY}
                Z
            `;
            // If barWidth is very small, we effectively draw a circle of radius `barHeight/2`
            // but its width should be `barWidth`. This means it's not a circle but a tiny pill.
            // The original logic for small bars was to make a circle of radius `radius`.
            // If barWidth is less than diameter, it should be a pill of that width.
            // Let's use a minimum width for the pill shape, otherwise it's just two semicircles.
            const minPillWidth = 0.1; // A small positive number
            const effectiveBarWidth = Math.max(minPillWidth, barWidth);

            if (effectiveBarWidth <= radius * 2) {
                 const R = effectiveBarWidth / 2; // Radius of the semicircles is half of the bar's width
                 pathData = `
                    M ${R},${barY}
                    L ${R},${barY} 
                    A ${R},${radius} 0 0,1 ${R},${barY + barHeight}
                    L ${R},${barY + barHeight}
                    A ${R},${radius} 0 0,1 ${R},${barY}
                    Z
                `;
            } else {
                 pathData = `
                    M ${radius},${barY}
                    L ${effectiveBarWidth - radius},${barY}
                    A ${radius},${radius} 0 0,1 ${effectiveBarWidth - radius},${barY + barHeight}
                    L ${radius},${barY + barHeight}
                    A ${radius},${radius} 0 0,1 ${radius},${barY}
                    Z
                `;
            }

        } else {
            pathData = `
                M ${radius},${barY}
                L ${barWidth - radius},${barY}
                A ${radius},${radius} 0 0,1 ${barWidth - radius},${barY + barHeight}
                L ${radius},${barY + barHeight}
                A ${radius},${radius} 0 0,1 ${radius},${barY}
                Z
            `;
        }
        
        barGroup.append("path")
            .attr("class", "mark bar")
            .attr("d", pathData)
            .attr("fill", fillStyle.barColor);

        // Category label and icon
        const iconHeight = barHeight * 0.9;
        const iconWidth = iconHeight * 1.33;
        const labelYPos = barY + barHeight / 2;
        let currentXOffset = -iconPadding; // Start from right to left

        const categoryLabelText = categoryFieldUnit !== "none" ? `${categoryName}${categoryFieldUnit}` : `${categoryName}`;
        const categoryLabel = barGroup.append("text")
            .attr("class", "label category-label")
            .attr("y", labelYPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryLabelText);
        
        // Position text first to get its width for icon placement
        currentXOffset -= estimateTextWidth(categoryLabelText, {
             fontFamily: fillStyle.typography.labelFontFamily,
             fontSize: fillStyle.typography.labelFontSize,
             fontWeight: fillStyle.typography.labelFontWeight
        });
        categoryLabel.attr("x", currentXOffset);


        const iconUrl = imagesConfig.field && imagesConfig.field[categoryName] ? imagesConfig.field[categoryName] : null;
        if (iconUrl) {
            currentXOffset -= (iconPadding + iconWidth/2) ; // Adjust for icon center
            barGroup.append("image")
                .attr("class", "icon category-icon")
                .attr("x", currentXOffset - iconWidth/2) // Center icon
                .attr("y", labelYPos - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
            currentXOffset -= iconWidth/2; // Move past the icon
        }


        // Value label
        const dynamicFontSize = `${Math.max(8, barHeight * 0.5)}px`; // Ensure min font size, e.g. 8px
        const formattedValue = valueFieldUnit !== "none" ?
            `${formatValue(value)}${valueFieldUnit}` :
            `${formatValue(value)}`;

        const valueLabelWidth = estimateTextWidth(formattedValue, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: dynamicFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });

        const labelFitsInside = valueLabelWidth + 10 < (barWidth - radius); // Check against bar width minus one radius for padding

        const valueLabel = barGroup.append("text")
            .attr("class", "label value-label")
            .attr("y", barY + barHeight / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", dynamicFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .text(formattedValue);

        if (labelFitsInside) {
            valueLabel
                .attr("x", barWidth - 5 - (barWidth > radius ? radius/2 : 0)) // Position inside, accounting for right rounded end
                .attr("text-anchor", "end")
                .style("fill", fillStyle.barLabelColorInside);
        } else {
            valueLabel
                .attr("x", barWidth + 5) // Position outside
                .attr("text-anchor", "start")
                .style("fill", fillStyle.barLabelColorOutside);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_15",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal grouped bar chart.
    // It expects data with x (category), y (value), and group fields.
    // Icons can be displayed next to x-categories.
    // Bars have rounded right ends.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Handles data.colors or data.colors_dark if passed as data.colors
    const imagesConfig = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldRole = "x";
    const valueFieldRole = "y";
    const groupFieldRole = "group";

    const categoryColumn = dataColumns.find(col => col.role === categoryFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);
    const groupColumn = dataColumns.find(col => col.role === groupFieldRole);

    if (!categoryColumn || !valueColumn || !groupColumn) {
        let missing = [];
        if (!categoryColumn) missing.push(`role '${categoryFieldRole}'`);
        if (!valueColumn) missing.push(`role '${valueFieldRole}'`);
        if (!groupColumn) missing.push(`role '${groupFieldRole}'`);
        const errorMessage = `Critical chart configuration missing: column(s) for ${missing.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;
    const groupFieldName = groupColumn.name;

    const categoryFieldUnit = categoryColumn.unit && categoryColumn.unit !== "none" ? categoryColumn.unit : "";
    const valueFieldUnit = valueColumn.unit && valueColumn.unit !== "none" ? valueColumn.unit : "";
    // const groupFieldUnit = groupColumn.unit && groupColumn.unit !== "none" ? groupColumn.unit : ""; // Not typically used for display

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#0f223b',
        defaultPrimaryColor: '#1f77b4', 
        defaultAvailableColors: d3.schemeCategory10,
    };

    fillStyle.primaryAccent = (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : fillStyle.defaultPrimaryColor;
    
    fillStyle.getBarColor = (groupValue, groupIndex) => {
        if (colorsConfig.field && colorsConfig.field[groupValue]) {
            return colorsConfig.field[groupValue];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[groupIndex % colorsConfig.available_colors.length];
        }
        return fillStyle.defaultAvailableColors[groupIndex % fillStyle.defaultAvailableColors.length];
    };

    fillStyle.getIconUrl = (categoryValue) => {
        if (imagesConfig.field && imagesConfig.field[categoryValue]) {
            return imagesConfig.field[categoryValue];
        }
        // No fallback to images.other.primary for category-specific icons unless specified
        return null; 
    };

    fillStyle.typography = {
        // title key is not used as per V.1, but kept for structure if typographyConfig has it
        title: { 
            font_family: (typographyConfig.title && typographyConfig.title.font_family) ? typographyConfig.title.font_family : 'Arial, sans-serif',
            font_size: (typographyConfig.title && typographyConfig.title.font_size) ? typographyConfig.title.font_size : '16px',
            font_weight: (typographyConfig.title && typographyConfig.title.font_weight) ? typographyConfig.title.font_weight : 'bold',
        },
        label: {
            font_family: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            font_size: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            font_weight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
        },
        annotation: {
            font_family: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            font_size: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            font_weight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        }
    };
    
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontProps.font_family);
        tempTextElement.setAttribute('font-size', fontProps.font_size);
        tempTextElement.setAttribute('font-weight', fontProps.font_weight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // getComputedTextLength is preferred for unattached elements.
        // Fallback to a heuristic if not available (e.g. older environments/JSDOM).
        return tempTextElement.getComputedTextLength ? tempTextElement.getComputedTextLength() : (text.length * (parseFloat(fontProps.font_size) * 0.6));
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

    function createRightSemicirclePath(x, y, barWidth, barHeight) {
        const radius = barHeight / 2;
        if (barWidth <= 1e-6) return ""; 

        if (barWidth >= radius) {
            const rectPartWidth = barWidth - radius;
            return `M${x},${y} L${x + rectPartWidth},${y} A${radius},${radius} 0 0,1 ${x + rectPartWidth},${y + barHeight} L${x},${y + barHeight} Z`;
        } else {
            const arcRx = Math.max(0, barWidth); 
            const arcRy = radius;
            return `M${x},${y} A${arcRx},${arcRy} 0 1,1 ${x},${y + barHeight} Z`;
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root-svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    const ICON_WIDTH_ESTIMATE = 25; 
    const ICON_HEIGHT_ESTIMATE = (ICON_WIDTH_ESTIMATE / 1.33); 
    const ICON_TEXT_PADDING = 5; 
    const CATEGORY_LABEL_AREA_RIGHT_PADDING = 10; 

    let maxCategoryLabelAreaWidth = 0;
    categories.forEach(cat => {
        const labelText = categoryFieldUnit ? `${cat}${categoryFieldUnit}` : `${cat}`;
        const textWidth = estimateTextWidth(labelText, fillStyle.typography.label);
        let currentLabelAreaWidth = textWidth;
        if (fillStyle.getIconUrl(cat)) { 
            currentLabelAreaWidth += ICON_WIDTH_ESTIMATE + ICON_TEXT_PADDING;
        }
        maxCategoryLabelAreaWidth = Math.max(maxCategoryLabelAreaWidth, currentLabelAreaWidth);
    });
    
    let maxValueLabelWidth = 0;
    chartData.forEach(d => {
        const value = +d[valueFieldName];
        const formattedValue = valueFieldUnit ? `${formatValue(value)}${valueFieldUnit}` : `${formatValue(value)}`;
        const textWidth = estimateTextWidth(formattedValue, fillStyle.typography.annotation);
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });

    const LEGEND_ITEM_HEIGHT = 15;
    const LEGEND_RECT_WIDTH = 15;
    const LEGEND_RECT_TEXT_PADDING = 5;
    const LEGEND_INTER_ITEM_PADDING = 10;
    let totalLegendWidth = 0;
    const legendItemWidths = groups.map(group => {
        const textWidth = estimateTextWidth(group, fillStyle.typography.label);
        const itemWidth = LEGEND_RECT_WIDTH + LEGEND_RECT_TEXT_PADDING + textWidth;
        totalLegendWidth += itemWidth;
        return itemWidth;
    });
    if (groups.length > 1) {
        totalLegendWidth += (groups.length - 1) * LEGEND_INTER_ITEM_PADDING;
    }

    const chartMargins = {
        top: (groups.length > 0 ? LEGEND_ITEM_HEIGHT + 20 : 20),
        right: maxValueLabelWidth + 15, // Value labels + padding
        bottom: 20,
        left: maxCategoryLabelAreaWidth + CATEGORY_LABEL_AREA_RIGHT_PADDING + 10 
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMessage = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Adjust container size or margins.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    // Data is used as is; categories and groups extracted earlier. Order is preserved.

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerHeight])
        .padding(0.2); // Fixed inter-category band padding

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueFieldName]) || 1]) // Ensure domain is at least [0,1]
        .range([0, innerWidth]);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.getBarColor(group, i)));

    // Block 7: Chart Component Rendering (Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group chart-area"); // Added chart-area class

    if (groups.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2})`);

        let currentLegendX = 0;
        groups.forEach((group, i) => {
            const legendItemG = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentLegendX}, 0)`);

            legendItemG.append("rect")
                .attr("class", "mark legend-item-mark")
                .attr("width", LEGEND_RECT_WIDTH)
                .attr("height", LEGEND_ITEM_HEIGHT)
                .attr("fill", colorScale(group))
                .attr("rx", 2) 
                .attr("ry", 2);

            legendItemG.append("text")
                .attr("class", "label legend-item-label")
                .attr("x", LEGEND_RECT_WIDTH + LEGEND_RECT_TEXT_PADDING)
                .attr("y", LEGEND_ITEM_HEIGHT / 2)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", fillStyle.typography.label.font_size)
                .style("font-weight", fillStyle.typography.label.font_weight)
                .style("fill", fillStyle.textColor)
                .text(group);
            
            currentLegendX += legendItemWidths[i] + (i < groups.length - 1 ? LEGEND_INTER_ITEM_PADDING : 0);
        });
    }
    
    // Block 8: Main Data Visualization Rendering (Bars and Value Labels)
    const categoryBands = mainChartGroup.selectAll(".category-band")
        .data(categories)
        .enter()
        .append("g")
        .attr("class", "category-band")
        .attr("transform", d => `translate(0, ${yScale(d)})`);

    categoryBands.each(function(categoryName) {
        const bandSelection = d3.select(this);
        const categoryData = chartData.filter(d => d[categoryFieldName] === categoryName);
        const bandHeight = yScale.bandwidth();
        const groupBarHeight = bandHeight / groups.length; // No inner padding between group bars

        groups.forEach((groupName, groupIndex) => {
            const dataPoint = categoryData.find(d => d[groupFieldName] === groupName);
            if (dataPoint) {
                const value = +dataPoint[valueFieldName];
                const barWidth = xScale(value < 0 ? 0 : value); // Ensure barWidth is not negative
                const barY = groupIndex * groupBarHeight;

                bandSelection.append("path")
                    .attr("class", "mark bar")
                    .attr("d", createRightSemicirclePath(0, barY, barWidth, groupBarHeight))
                    .attr("fill", colorScale(groupName));

                const formattedValueText = valueFieldUnit ? `${formatValue(value)}${valueFieldUnit}` : formatValue(value);
                const valueLabelFontSize = Math.max(groupBarHeight * 0.45, parseFloat(fillStyle.typography.annotation.font_size));

                bandSelection.append("text")
                    .attr("class", "label value-label")
                    .attr("x", barWidth + 5) // Value label to the right of the bar
                    .attr("y", barY + groupBarHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotation.font_family)
                    .style("font-size", `${valueLabelFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotation.font_weight)
                    .style("fill", fillStyle.textColor)
                    .text(formattedValueText);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing (Category Labels and Icons)
    categoryBands.each(function(categoryName) {
        const bandSelection = d3.select(this);
        const bandHeight = yScale.bandwidth();
        const bandCenterY = bandHeight / 2;

        const labelTextWithUnit = categoryFieldUnit ? `${categoryName}${categoryFieldUnit}` : `${categoryName}`;
        
        const iconUrl = fillStyle.getIconUrl(categoryName);
        let actualIconWidth = 0;
        let actualIconHeight = 0;
        
        if (iconUrl) {
            actualIconHeight = Math.min(bandHeight * 0.8, ICON_HEIGHT_ESTIMATE * 1.2); 
            actualIconWidth = actualIconHeight * 1.33; 
        }

        let textXPosition = -CATEGORY_LABEL_AREA_RIGHT_PADDING; 

        if (iconUrl) {
            // Icon is to the left of text, text is to the left of icon
            // [Icon] [Text] | Bar Area
            // Text X is anchor-end, so it's its right edge
            textXPosition = -(CATEGORY_LABEL_AREA_RIGHT_PADDING + actualIconWidth + ICON_TEXT_PADDING);
            
            bandSelection.append("image")
                .attr("class", "icon category-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", -(CATEGORY_LABEL_AREA_RIGHT_PADDING + actualIconWidth)) // Icon's left edge
                .attr("y", bandCenterY - actualIconHeight / 2)
                .attr("width", actualIconWidth)
                .attr("height", actualIconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
        
        bandSelection.append("text")
            .attr("class", "label category-label") // Changed from y-axis-category-label for brevity
            .attr("x", textXPosition)
            .attr("y", bandCenterY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("font-weight", fillStyle.typography.label.font_weight)
            .style("fill", fillStyle.textColor)
            .text(labelTextWithUnit);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
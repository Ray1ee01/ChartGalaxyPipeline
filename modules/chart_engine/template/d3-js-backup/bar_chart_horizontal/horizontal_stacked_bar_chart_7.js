/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "refactored_horizontal_stacked_bar_chart",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x", "group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 20], [0, "inf"], [2, 4]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["text_color", "background_color", "y_axis_tick_background", "y_axis_tick_text", "data_label_on_bar_fill"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || {};
    const inputImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldDef = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldDef ? xFieldDef.name : undefined;
    const yFieldName = yFieldDef ? yFieldDef.name : undefined;
    const groupFieldName = groupFieldDef ? groupFieldDef.name : undefined;

    const xFieldUnit = xFieldDef && xFieldDef.unit !== "none" ? xFieldDef.unit : "";
    const yFieldUnit = yFieldDef && yFieldDef.unit !== "none" ? yFieldDef.unit : "";
    // const groupFieldUnit = groupFieldDef && groupFieldDef.unit !== "none" ? groupFieldDef.unit : ""; // Not used in rendering

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: {
                font_family: (inputTypography.title && inputTypography.title.font_family) || "Arial, sans-serif",
                font_size: (inputTypography.title && inputTypography.title.font_size) || "16px",
                font_weight: (inputTypography.title && inputTypography.title.font_weight) || "bold",
            },
            label: {
                font_family: (inputTypography.label && inputTypography.label.font_family) || "Arial, sans-serif",
                font_size: (inputTypography.label && inputTypography.label.font_size) || "12px",
                font_weight: (inputTypography.label && inputTypography.label.font_weight) || "normal",
            },
            annotation: {
                font_family: (inputTypography.annotation && inputTypography.annotation.font_family) || "Arial, sans-serif",
                font_size: (inputTypography.annotation && inputTypography.annotation.font_size) || "10px",
                font_weight: (inputTypography.annotation && inputTypography.annotation.font_weight) || "normal",
            }
        },
        textColor: inputColors.text_color || '#333333',
        chartBackground: inputColors.background_color || '#FFFFFF',
        yAxisTickBackgroundColor: (inputColors.other && inputColors.other.y_axis_tick_background) || 'rgba(0,0,0,0.7)',
        yAxisTickTextColor: (inputColors.other && inputColors.other.y_axis_tick_text) || '#FFFFFF',
        dataLabelOnBarFill: (inputColors.other && inputColors.other.data_label_on_bar_fill) || '#FFFFFF',
        imageUrls: {}, // To be populated if images are used
        groupColorScale: null // To be defined in Block 6
    };

    if (inputImages.field) {
        fillStyle.imageUrls.xCategoryIcons = inputImages.field;
    } else if (inputImages.other && inputImages.other.primary) {
        // Example: if there was a generic fallback icon, not used here
    }
    
    function estimateTextWidth(text, fontProps) {
        if (!text || text.length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family);
        tempText.setAttribute('font-size', fontProps.font_size);
        tempText.setAttribute('font-weight', fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox works on SVG elements not attached to the live DOM.
        return tempText.getBBox().width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~s")(value);
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
    let chartMargins = { // let, because top margin might change for legend
        top: 50,
        right: 100,
        bottom: 80,
        left: 200
    };

    const calculateInnerDims = () => ({
        innerWidth: containerWidth - chartMargins.left - chartMargins.right,
        innerHeight: containerHeight - chartMargins.top - chartMargins.bottom
    });

    let { innerWidth, innerHeight } = calculateInnerDims();
    
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-content")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(rawChartData.map(d => d[groupFieldName]))).sort(d3.ascending); // Sort for consistent color mapping

    const groupedData = d3.group(rawChartData, d => d[xFieldName]);
    const processedData = Array.from(groupedData, ([key, values]) => {
        const obj = { [xFieldName]: key }; // Use dynamic key for xField
        groups.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[yFieldName]);
        });
        obj.total = d3.sum(values, d => +d[yFieldName]);
        return obj;
    });

    const stackGenerator = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) // Keep original group order for stacking
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d[xFieldName]))
        .range([innerHeight, 0])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) || 0]) // Ensure domain starts at 0, handle empty data
        .range([0, innerWidth])
        .nice();

    let colorRange;
    if (inputColors.field && groups.every(g => inputColors.field[g])) {
        colorRange = groups.map(g => inputColors.field[g]);
    } else if (inputColors.available_colors && inputColors.available_colors.length > 0) {
        colorRange = inputColors.available_colors;
    } else {
        colorRange = d3.schemeCategory10;
    }
    fillStyle.groupColorScale = d3.scaleOrdinal().domain(groups).range(colorRange);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // X-Axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .tickSize(0)
            .tickPadding(10)
            .tickFormat(d => formatValue(d) + (d === d3.max(xScale.domain()) ? yFieldUnit : "")) // Add unit only to last tick for clarity
        );
    
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll("text")
        .attr("class", "text axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight);

    // Y-Axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale)
            .tickSize(0)
            .tickPadding(10)
        );
    
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll(".tick").each(function(d) {
        const tick = d3.select(this);
        const tickText = d; // The category name from xFieldName
        
        tick.select("text").remove(); // Remove default text node

        tick.append("rect")
            .attr("class", "other y-axis-tick-background")
            .attr("x", -chartMargins.left + 5)
            .attr("y", -yScale.bandwidth() / 2)
            .attr("width", chartMargins.left - 10)
            .attr("height", yScale.bandwidth())
            .attr("fill", fillStyle.yAxisTickBackgroundColor)
            .attr("rx", 3)
            .attr("ry", 3);
        
        tick.append("text")
            .attr("class", "text y-axis-tick-label")
            .attr("x", -10)
            .attr("y", 0) // Vertically centered by dominant-baseline
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("fill", fillStyle.yAxisTickTextColor)
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("font-weight", fillStyle.typography.label.font_weight)
            .text(tickText);
    });

    // Legend (Positioned relative to svgRoot, might adjust chartMargins.top)
    const legendFontProps = fillStyle.typography.label; // Use label typography for legend items
    const legendTitleFontProps = { // Slightly bolder for title
        ...fillStyle.typography.label,
        font_weight: "bold"
    };

    const legendItemPaddingHorizontal = 10;
    const legendSwatchSize = 15;
    const legendSwatchTextGap = 5;

    const legendTitleText = groupFieldName;
    const legendTitleWidth = estimateTextWidth(legendTitleText, legendTitleFontProps) + legendItemPaddingHorizontal * 2;

    const legendItems = groups.map(group => ({
        key: group,
        width: estimateTextWidth(group, legendFontProps) + legendSwatchSize + legendSwatchTextGap + legendItemPaddingHorizontal
    }));
    
    const totalLegendWidthOneLine = legendTitleWidth + legendItems.reduce((sum, item) => sum + item.width, 0);
    const availableWidthForLegend = containerWidth - 20; // Some padding

    let legendGroupYOffset = 20; // Initial Y offset for legend from top of SVG
    let legendRequiresTwoLines = totalLegendWidthOneLine > availableWidthForLegend && legendItems.length > 1; // Don't do two lines for just title + 1 item

    if (legendRequiresTwoLines) {
        const legendLineHeight = parseFloat(legendFontProps.font_size) + 10;
        const newTopMargin = legendLineHeight * 2 + legendGroupYOffset; // Approximate height for two lines + title
        if (newTopMargin > chartMargins.top) {
            chartMargins.top = newTopMargin;
            ({ innerWidth, innerHeight } = calculateInnerDims()); // Recalculate inner dimensions
            
            // Update scales and mainChartGroup transform
            yScale.range([innerHeight, 0]);
            xScale.range([0, innerWidth]).nice(); // Re-nice after range change
            mainChartGroup.attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);
            xAxisGroup.attr("transform", `translate(0, ${innerHeight})`);
            // Re-render X-axis if its ticks depend on new scale range (already handled by call)
             xAxisGroup.call(d3.axisBottom(xScale).tickSize(0).tickPadding(10)
                .tickFormat(d => formatValue(d) + (d === d3.max(xScale.domain()) ? yFieldUnit : "")))
                .select(".domain").remove();
            xAxisGroup.selectAll("text")
                .style("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", fillStyle.typography.label.font_size)
                .style("font-weight", fillStyle.typography.label.font_weight);

        }
    }
    
    const legendContainerGroup = svgRoot.append("g")
        .attr("class", "other legend-container")
        .attr("transform", `translate(${chartMargins.left / 2}, ${legendGroupYOffset})`); // Position legend

    const legendTitle = legendContainerGroup.append("text")
        .attr("class", "text legend-title")
        .attr("x", 0)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.textColor)
        .style("font-family", legendTitleFontProps.font_family)
        .style("font-size", legendTitleFontProps.font_size)
        .style("font-weight", legendTitleFontProps.font_weight)
        .text(legendTitleText);

    let currentXOffset = legendRequiresTwoLines ? 0 : legendTitleWidth;
    let currentYOffset = legendRequiresTwoLines ? (parseFloat(legendFontProps.font_size) + 10) : 0; // Move to second line if needed

    legendItems.forEach((item) => {
        if (legendRequiresTwoLines && currentXOffset + item.width > availableWidthForLegend && currentXOffset > 0) {
            // This logic is for wrapping within the items, but the current setup is title on line 1, items on line 2
            // The provided logic was simpler: if total width too large, title on line 1, all items on line 2.
            // The currentXOffset starts at 0 for line 2 if legendRequiresTwoLines is true.
        }

        const legendItemGroup = legendContainerGroup.append("g")
            .attr("class", "other legend-item")
            .attr("transform", `translate(${currentXOffset}, ${currentYOffset})`);

        legendItemGroup.append("rect")
            .attr("class", "mark legend-swatch")
            .attr("width", legendSwatchSize)
            .attr("height", legendSwatchSize)
            .attr("y", -legendSwatchSize / 2)
            .style("fill", fillStyle.groupColorScale(item.key));

        legendItemGroup.append("text")
            .attr("class", "text legend-label")
            .attr("x", legendSwatchSize + legendSwatchTextGap)
            .attr("y", 0)
            .attr("dominant-baseline", "middle")
            .style("fill", fillStyle.textColor)
            .style("font-family", legendFontProps.font_family)
            .style("font-size", legendFontProps.font_size)
            .style("font-weight", legendFontProps.font_weight)
            .text(item.key);
        
        currentXOffset += item.width;
    });


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barLayers = mainChartGroup.selectAll(".bar-layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `mark-group bar-layer layer-${d.key.replace(/\s+/g, '-')}`) // Sanitize key for class
        .style("fill", d => fillStyle.groupColorScale(d.key));

    barLayers.selectAll("rect")
        .data(d => d.map(s => ({ ...s, key: d.key }))) // Add key to segment data for access
        .enter().append("rect")
        .attr("class", "mark bar")
        .attr("y", d => yScale(d.data[xFieldName]))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => Math.max(0, xScale(d[1]) - xScale(d[0]))) // Ensure non-negative width
        .attr("height", yScale.bandwidth());

    // Data Labels on Bars
    barLayers.selectAll(".data-label") // Use a class for data labels
        .data(d => d.map(s => ({ ...s, key: d.key })))
        .enter().append("text")
        .attr("class", "label value-label data-label")
        .attr("y", d => yScale(d.data[xFieldName]) + yScale.bandwidth() / 2)
        .attr("x", d => {
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            return xScale(d[0]) + segmentWidth / 2;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.dataLabelOnBarFill)
        .style("font-family", fillStyle.typography.annotation.font_family)
        .style("font-size", fillStyle.typography.annotation.font_size)
        .style("font-weight", fillStyle.typography.annotation.font_weight)
        .text(d => {
            const value = d[1] - d[0];
            if (value === 0) return ""; // Don't show label for zero value segments
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            const formattedText = `${formatValue(value)}${yFieldUnit}`;
            const textWidth = estimateTextWidth(formattedText, fillStyle.typography.annotation);
            return (segmentWidth > textWidth && value > 0) ? formattedText : '';
        });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons)
    const iconSize = yScale.bandwidth() * 0.7;
    if (fillStyle.imageUrls.xCategoryIcons) {
        mainChartGroup.selectAll(".icon-x-category")
            .data(processedData)
            .enter()
            .append("image")
            .attr("class", "icon x-category-icon")
            .attr("x", innerWidth + 10) // Position to the right of bars
            .attr("y", d => yScale(d[xFieldName]) + (yScale.bandwidth() - iconSize) / 2)
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("xlink:href", d => fillStyle.imageUrls.xCategoryIcons[d[xFieldName]] || null) // Handle missing icon for a category
            .each(function(d) { // Remove image if href is null/invalid
                if (!d3.select(this).attr("xlink:href")) {
                    d3.select(this).remove();
                }
            });
    }
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
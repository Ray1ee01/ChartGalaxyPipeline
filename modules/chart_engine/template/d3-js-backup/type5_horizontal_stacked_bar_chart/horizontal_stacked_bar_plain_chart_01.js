/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
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
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldDef = dataColumns.find(col => col.role === groupFieldRole);

    const categoryFieldName = xFieldDef ? xFieldDef.name : undefined;
    const valueFieldName = yFieldDef ? yFieldDef.name : undefined;
    const groupFieldName = groupFieldDef ? groupFieldDef.name : undefined;
    
    const yValueUnit = yFieldDef && yFieldDef.unit !== "none" ? yFieldDef.unit : "";

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push("x-role field");
        if (!valueFieldName) missingFields.push("y-role field");
        if (!groupFieldName) missingFields.push("group-role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: {
                font_family: (rawTypography.title && rawTypography.title.font_family) || "Arial, sans-serif",
                font_size: (rawTypography.title && rawTypography.title.font_size) || "16px",
                font_weight: (rawTypography.title && rawTypography.title.font_weight) || "bold",
            },
            label: {
                font_family: (rawTypography.label && rawTypography.label.font_family) || "Arial, sans-serif",
                font_size: (rawTypography.label && rawTypography.label.font_size) || "12px",
                font_weight: (rawTypography.label && rawTypography.label.font_weight) || "normal",
            },
            annotation: {
                font_family: (rawTypography.annotation && rawTypography.annotation.font_family) || "Arial, sans-serif",
                font_size: (rawTypography.annotation && rawTypography.annotation.font_size) || "10px",
                font_weight: (rawTypography.annotation && rawTypography.annotation.font_weight) || "normal",
            }
        },
        textColor: rawColors.text_color || "#333333",
        chartBackground: rawColors.background_color || "transparent", // Default to transparent
        primaryAccent: (rawColors.other && rawColors.other.primary) || "#007bff",
        defaultCategoryColor: "#CCCCCC",
        defaultColorScheme: d3.schemeCategory10,
        imageUrls: {
            field: (rawImages.field || {}),
            other: (rawImages.other || {})
        }
    };

    fillStyle.getGroupColor = (groupName, index) => {
        if (rawColors.field && rawColors.field[groupName]) {
            return rawColors.field[groupName];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[index % rawColors.available_colors.length];
        }
        return fillStyle.defaultColorScheme[index % fillStyle.defaultColorScheme.length];
    };
    
    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const { font_family, font_size, font_weight } = fontProps;
        const svgNS = "http://www.w3.org/2000/svg";
        const tempSvg = document.createElementNS(svgNS, "svg");
        const tempText = document.createElementNS(svgNS, "text");
        tempText.setAttribute("font-family", font_family);
        tempText.setAttribute("font-size", font_size); // font_size is already string e.g. "12px"
        tempText.setAttribute("font-weight", font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append tempSvg to DOM
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM
            return text.length * (parseFloat(font_size) || 12) * 0.6; 
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~.1f")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~.1f")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~.1f")(value / 1000) + "K";
        }
        return d3.format("~g")(value);
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 70, // Increased top margin for legend
        right: 30,
        bottom: 50, // Reduced bottom margin as X-axis labels are removed
        left: variables.y_axis_label_width || 200 // Configurable left margin for long Y-axis labels / icons
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartData.map(d => d[groupFieldName]))).sort(); // Sort for consistent legend order

    const groupedData = d3.group(chartData, d => d[categoryFieldName]);
    const processedData = Array.from(groupedData, ([key, values]) => {
        const obj = { [categoryFieldName]: key };
        groups.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[valueFieldName]);
        });
        obj.total = d3.sum(values, d => +d[valueFieldName]);
        return obj;
    });

    const stackGenerator = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) // Keep original order of groups
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d[categoryFieldName]))
        .range([innerHeight, 0])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) || 1]) // Ensure domain is at least [0,1]
        .range([0, innerWidth])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.getGroupColor(group, i)));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .tickSize(5) // Minimal ticks
            .tickPadding(10)
            .tickFormat(d => formatValue(d)) // Format X-axis ticks
        );
    
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll("text") // Style X-axis tick labels
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label");


    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale)
            .tickSize(0)
            .tickPadding(10)
        );
        
    yAxisGroup.select(".domain").remove();
    
    yAxisGroup.selectAll(".tick text")
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label");

    // Legend Rendering
    if (groups && groups.length > 0) {
        const legendMarkerWidth = 12;
        const legendMarkerHeight = 12;
        const legendMarkerRx = 3;
        const legendMarkerRy = 3;
        const legendPadding = 6;
        const legendInterItemSpacing = 12;
        const legendItemFontProps = fillStyle.typography.label;

        const legendItemsData = groups.map((group, i) => {
            const text = String(group);
            const color = colorScale(group);
            const textWidth = estimateTextWidth(text, legendItemFontProps);
            const visualWidth = legendMarkerWidth + legendPadding + textWidth;
            return { text, color, visualWidth };
        });

        const legendLines = [];
        let currentLineItems = [];
        let currentLineVisualWidth = 0;
        const availableWidthForLegendWrapping = innerWidth;

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth;
            if (currentLineItems.length > 0) {
                widthIfAdded += legendInterItemSpacing;
            }
            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > availableWidthForLegendWrapping) {
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                currentLineItems = [item];
                currentLineVisualWidth = item.visualWidth;
            } else {
                if (currentLineItems.length > 0) {
                    currentLineVisualWidth += legendInterItemSpacing;
                }
                currentLineItems.push(item);
                currentLineVisualWidth += item.visualWidth;
            }
        });
        if (currentLineItems.length > 0) {
            legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
        }

        if (legendLines.length > 0) {
            const itemMaxHeight = Math.max(legendMarkerHeight, parseFloat(legendItemFontProps.font_size));
            const interLineVerticalPadding = 6;
            const paddingBelowLegendToChart = 15;
            const minSvgGlobalTopPadding = 15;

            const totalLegendBlockHeight = legendLines.length * itemMaxHeight + Math.max(0, legendLines.length - 1) * interLineVerticalPadding;
            let legendBlockStartY = chartMargins.top - paddingBelowLegendToChart - totalLegendBlockHeight;
            legendBlockStartY = Math.max(minSvgGlobalTopPadding, legendBlockStartY);

            const legendContainerGroup = svgRoot.append("g")
                .attr("class", "legend")
                .attr("transform", `translate(0, ${legendBlockStartY})`);

            // Legend Title (Group Field Name)
            const legendTitleFontProps = { // Use label font, but bold
                font_family: fillStyle.typography.label.font_family,
                font_size: fillStyle.typography.label.font_size, // Slightly larger or same as items
                font_weight: "bold",
            };
            const legendTitleText = groupFieldName;
            const legendTitleWidth = estimateTextWidth(legendTitleText, legendTitleFontProps);
            
            legendContainerGroup.append("text")
                .attr("class", "label legend-title")
                .attr("x", chartMargins.left + innerWidth / 2) // Centered above chart area
                .attr("y", -10) // Position above the first line of legend items
                .attr("text-anchor", "middle")
                .style("font-family", legendTitleFontProps.font_family)
                .style("font-size", legendTitleFontProps.font_size)
                .style("font-weight", legendTitleFontProps.font_weight)
                .style("fill", fillStyle.textColor)
                .text(legendTitleText);
            
            let currentLineBaseY = 0; // Relative to legendContainerGroup
            if (legendTitleText) currentLineBaseY += parseFloat(legendTitleFontProps.font_size) + 5; // Add space after title

            legendLines.forEach((line) => {
                const lineRenderStartX = chartMargins.left + (innerWidth - line.totalVisualWidth) / 2; // Centered within chart area
                const lineCenterY = currentLineBaseY + itemMaxHeight / 2;
                let currentItemDrawX = lineRenderStartX;

                line.items.forEach((item, itemIndex) => {
                    legendContainerGroup.append("rect")
                        .attr("class", "mark legend-item-mark")
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (itemMaxHeight - legendMarkerHeight) / 2)
                        .attr("width", legendMarkerWidth)
                        .attr("height", legendMarkerHeight)
                        .attr("rx", legendMarkerRx)
                        .attr("ry", legendMarkerRy)
                        .attr("fill", item.color);

                    legendContainerGroup.append("text")
                        .attr("class", "label legend-item-label")
                        .attr("x", currentItemDrawX + legendMarkerWidth + legendPadding)
                        .attr("y", lineCenterY)
                        .attr("dominant-baseline", "middle")
                        .style("font-family", legendItemFontProps.font_family)
                        .style("font-size", legendItemFontProps.font_size)
                        .style("font-weight", legendItemFontProps.font_weight)
                        .style("fill", fillStyle.textColor)
                        .text(item.text);

                    if (itemIndex < line.items.length - 1) {
                         currentItemDrawX += item.visualWidth + legendInterItemSpacing;
                    }
                });
                currentLineBaseY += itemMaxHeight + interLineVerticalPadding;
            });
        }
    }

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barLayers = mainChartGroup.selectAll(".bar-layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `mark bar-layer layer-${d.key.replace(/\s+/g, '-')}`) // Add class for group key
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll("rect")
        .data(d => d.map(item => ({ ...item, key: d.key }))) // Add key to inner data for access
        .enter().append("rect")
        .attr("class", "mark bar-segment")
        .attr("y", d => yScale(d.data[categoryFieldName]))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => Math.max(0, xScale(d[1]) - xScale(d[0]))) // Ensure non-negative width
        .attr("height", yScale.bandwidth())
        .style("stroke", "none"); // No stroke as per simplification

    // Data labels on bars
    const dataLabelFontProps = fillStyle.typography.annotation;
    barLayers.selectAll(".data-label")
        .data(d => d.map(item => ({ ...item, key: d.key })))
        .enter().append("text")
        .attr("class", "value data-label")
        .attr("y", d => yScale(d.data[categoryFieldName]) + yScale.bandwidth() / 2)
        .attr("x", d => {
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            return xScale(d[0]) + segmentWidth / 2;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", "#ffffff") // Assuming white contrasts well with bar colors
        .style("font-family", dataLabelFontProps.font_family)
        .style("font-size", dataLabelFontProps.font_size)
        .style("font-weight", dataLabelFontProps.font_weight)
        .text(d => {
            const value = d[1] - d[0];
            if (value === 0) return ""; // Don't show label for zero value segments
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            const formattedText = `${formatValue(value)}${yValueUnit}`;
            const textWidth = estimateTextWidth(formattedText, dataLabelFontProps);
            return (segmentWidth > textWidth && value > 0) ? formattedText : '';
        });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Y-axis icons
    const yTickPadding = parseFloat(yAxisGroup.selectAll(".tick text").node()?.getAttribute("x") || -10) * -1; // Get existing padding
    const iconSize = yScale.bandwidth() * 0.6;
    const iconTextGap = 5;

    yAxisGroup.selectAll(".tick").each(function(d) {
        const tick = d3.select(this);
        const categoryName = d; // d is the category name (e.g., period)
        const iconUrl = fillStyle.imageUrls.field[categoryName];

        if (iconUrl) {
            tick.append("image")
                .attr("class", "icon y-axis-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", -(iconSize + yTickPadding + iconTextGap)) // Position icon to the left of text
                .attr("y", -iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize);
            
            tick.select("text") // Adjust text position if icon is present
                 .attr("x", -(iconSize + yTickPadding + iconTextGap + iconTextGap)); // Further shift text
        }
    });


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
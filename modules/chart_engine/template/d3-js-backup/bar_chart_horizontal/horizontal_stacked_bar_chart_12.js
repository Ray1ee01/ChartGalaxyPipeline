/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart_12",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 4]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldConfig?.name;
    const yFieldName = yFieldConfig?.name;
    const groupFieldName = groupFieldConfig?.name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x role" : null,
            !yFieldName ? "y role" : null,
            !groupFieldName ? "group role" : null
        ].filter(Boolean).join(", ");
        
        const errorMessage = `Critical chart config missing: Field names for roles (${missingFields}) not found in data.data.columns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const xFieldUnit = xFieldConfig?.unit !== "none" ? xFieldConfig.unit : "";
    const yFieldUnit = yFieldConfig?.unit !== "none" ? yFieldConfig.unit : "";
    // const groupFieldUnit = groupFieldConfig?.unit !== "none" ? groupFieldConfig.unit : ""; // Not typically used for rendering

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: {
                font_family: rawTypography.title?.font_family || "Arial, sans-serif",
                font_size: rawTypography.title?.font_size || "16px",
                font_weight: rawTypography.title?.font_weight || "bold"
            },
            label: {
                font_family: rawTypography.label?.font_family || "Arial, sans-serif",
                font_size: rawTypography.label?.font_size || "12px",
                font_weight: rawTypography.label?.font_weight || "normal"
            },
            annotation: {
                font_family: rawTypography.annotation?.font_family || "Arial, sans-serif",
                font_size: rawTypography.annotation?.font_size || "10px",
                font_weight: rawTypography.annotation?.font_weight || "normal"
            }
        },
        colors: {
            textColor: rawColors.text_color || "#333333",
            backgroundColor: rawColors.background_color || "#FFFFFF",
            primaryAccent: rawColors.other?.primary || "#1f77b4",
            secondaryAccent: rawColors.other?.secondary || "#ff7f0e",
            defaultCategorical: rawColors.available_colors || ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
            fieldMapping: rawColors.field || {}
        },
        images: {
            fieldMapping: rawImages.field || {},
            otherMapping: rawImages.other || {}
        },
        dataLabelColor: "#FFFFFF" // Default for labels inside bars
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.font_family);
        textElement.setAttribute('font-size', fontProps.font_size);
        textElement.setAttribute('font-weight', fontProps.font_weight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        document.body.appendChild(svg); // Required for getBBox to work accurately in some browsers
        const width = textElement.getBBox().width;
        document.body.removeChild(svg);
        return width;
    }
    
    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~.1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.1f")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    function createRightSemicirclePath(x, y, barWidth, barHeight, radius) {
        if (barWidth <= 1e-9) return "";
        if (barWidth >= radius) {
            const rectPartWidth = barWidth - radius;
            return `M${x},${y} L${x + rectPartWidth},${y} A${radius},${radius} 0 0,1 ${x + rectPartWidth},${y + barHeight} L${x},${y + barHeight} Z`;
        } else {
            const arcRx = barWidth;
            const arcRy = radius;
            return `M${x},${y} A${arcRx},${arcRy} 0 1,1 ${x},${y + barHeight} Z`;
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.colors.backgroundColor)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 30, left: variables.left_margin || 200 }; // Adjusted bottom margin as X-axis is minimal
    
    // Adjust top margin dynamically if legend is present and needs space
    const uniqueGroupsForLegend = Array.from(new Set(rawChartData.map(d => d[groupFieldName])));
    if (uniqueGroupsForLegend.length > 0) {
        const legendItemEstimatedHeight = parseFloat(fillStyle.typography.label.font_size) + 4; // Rough estimate
        const legendLinesEstimate = 2; // Assume up to 2 lines for legend for margin calculation
        const legendVerticalSpace = legendLinesEstimate * legendItemEstimatedHeight + 25; // Includes padding
        chartMargins.top = Math.max(chartMargins.top, legendVerticalSpace);
    }
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroups = Array.from(new Set(rawChartData.map(d => d[groupFieldName])));

    const groupedData = d3.group(rawChartData, d => d[xFieldName]);
    const processedData = Array.from(groupedData, ([key, values]) => {
        const obj = { [xFieldName]: key }; // Use dynamic key for xField
        uniqueGroups.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[yFieldName]);
        });
        obj.total = d3.sum(values, d => +d[yFieldName]);
        return obj;
    });

    const stackGenerator = d3.stack()
        .keys(uniqueGroups)
        .order(d3.stackOrderNone) // Maintain original group order
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d[xFieldName]))
        .range([innerHeight, 0])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) || 1]) // Ensure domain is at least 1 to avoid issues with empty data
        .range([0, innerWidth])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(uniqueGroups)
        .range(uniqueGroups.map((group, i) => 
            fillStyle.colors.fieldMapping[group] || 
            fillStyle.colors.defaultCategorical[i % fillStyle.colors.defaultCategorical.length]
        ));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10).tickFormat(d => d))
        .call(g => g.select(".domain").remove());

    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .style("fill", fillStyle.colors.textColor);

    // X-axis (minimal, no domain or text as per original logic)
    mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10))
        .call(g => g.select(".domain").remove())
        .selectAll("text").remove();

    // Legend
    if (uniqueGroups.length > 0) {
        const legendMarkerWidth = 12;
        const legendMarkerHeight = 12;
        const legendMarkerRx = 3;
        const legendMarkerRy = 3;
        const legendPadding = 6;
        const legendInterItemSpacing = 12;
        const legendItemMaxHeight = Math.max(legendMarkerHeight, parseFloat(fillStyle.typography.label.font_size));
        const interLineVerticalPadding = 6;
        
        const legendItemsData = uniqueGroups.map(group => {
            const text = String(group);
            const color = colorScale(group);
            const textWidth = estimateTextWidth(text, fillStyle.typography.label);
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
            const totalLegendBlockHeight = legendLines.length * legendItemMaxHeight + Math.max(0, legendLines.length - 1) * interLineVerticalPadding;
            const legendBlockStartY = chartMargins.top - totalLegendBlockHeight - 15; // 15 is paddingBelowLegendToChart

            const legendContainerGroup = svgRoot.append("g")
                .attr("class", "legend custom-legend-container");
            
            let currentLineBaseY = legendBlockStartY;
            legendLines.forEach((line) => {
                const lineRenderStartX = chartMargins.left + (innerWidth - line.totalVisualWidth) / 2; // Centered within chart area
                const lineCenterY = currentLineBaseY + legendItemMaxHeight / 2;
                let currentItemDrawX = lineRenderStartX;

                line.items.forEach((item, itemIndex) => {
                    legendContainerGroup.append("rect")
                        .attr("class", "mark legend-marker")
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (legendItemMaxHeight - legendMarkerHeight) / 2)
                        .attr("width", legendMarkerWidth)
                        .attr("height", legendMarkerHeight)
                        .attr("rx", legendMarkerRx)
                        .attr("ry", legendMarkerRy)
                        .attr("fill", item.color)
                        .attr("fill-opacity", 0.85);

                    legendContainerGroup.append("text")
                        .attr("class", "label legend-label")
                        .attr("x", currentItemDrawX + legendMarkerWidth + legendPadding)
                        .attr("y", lineCenterY)
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.label.font_family)
                        .style("font-size", fillStyle.typography.label.font_size)
                        .style("font-weight", fillStyle.typography.label.font_weight)
                        .style("fill", fillStyle.colors.textColor)
                        .text(item.text);
                    
                    if (itemIndex < line.items.length - 1) {
                         currentItemDrawX += item.visualWidth + legendInterItemSpacing;
                    }
                });
                currentLineBaseY += legendItemMaxHeight + interLineVerticalPadding;
            });
        }
    }

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barLayers = mainChartGroup.selectAll(".layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `layer group-${d.key.toString().replace(/\s+/g, '-').toLowerCase()}`) // Class for group
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll("path.mark")
        .data(d => d.map(sd => ({ ...sd, key: d.key }))) // Add key to individual segment data for access
        .enter().append("path")
        .attr("class", "mark bar-segment")
        .attr("d", d => {
            const xPos = xScale(d[0]);
            const yPos = yScale(d.data[xFieldName]);
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            const barHeight = yScale.bandwidth();
            
            if (segmentWidth <= 1e-9 || isNaN(segmentWidth)) return "";

            const isRightmost = Math.abs(d[1] - d.data.total) < 1e-9;
            if (isRightmost) {
                return createRightSemicirclePath(xPos, yPos, segmentWidth, barHeight, barHeight / 2);
            } else {
                return `M${xPos},${yPos} L${xPos + segmentWidth},${yPos} L${xPos + segmentWidth},${yPos + barHeight} L${xPos},${yPos + barHeight} Z`;
            }
        });

    barLayers.selectAll("text.value")
        .data(d => d.map(sd => ({ ...sd, key: d.key })))
        .enter().append("text")
        .attr("class", "value data-label")
        .attr("y", d => yScale(d.data[xFieldName]) + yScale.bandwidth() / 2)
        .attr("x", d => {
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            return xScale(d[0]) + segmentWidth / 2;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.dataLabelColor)
        .style("font-family", fillStyle.typography.annotation.font_family)
        .style("font-size", fillStyle.typography.annotation.font_size)
        .style("font-weight", fillStyle.typography.annotation.font_weight)
        .text(d => {
            const value = d[1] - d[0];
            if (value <= 0) return "";
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            const formattedText = `${formatValue(value)}${yFieldUnit}`;
            const textWidth = estimateTextWidth(formattedText, fillStyle.typography.annotation);
            return (segmentWidth > textWidth && value > 0) ? formattedText : '';
        });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const iconSize = yScale.bandwidth() * 0.7;
    const iconPadding = 10;

    yAxisGroup.selectAll(".tick").each(function(d_tick) { // d_tick is the category name from yScale domain
        const tickGroup = d3.select(this);
        const imageUrl = fillStyle.images.fieldMapping[d_tick];

        if (imageUrl) {
            tickGroup.append("image")
                .attr("class", "icon y-axis-icon")
                .attr("x", -iconSize - iconPadding - (parseFloat(fillStyle.typography.label.font_size) / 2)) // Adjust based on text anchor and padding
                .attr("y", -iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", imageUrl);
            
            tickGroup.select("text") // Adjust text position if icon is present
                .attr("x", -iconSize - 2 * iconPadding - (parseFloat(fillStyle.typography.label.font_size) / 2));
        }
    });
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
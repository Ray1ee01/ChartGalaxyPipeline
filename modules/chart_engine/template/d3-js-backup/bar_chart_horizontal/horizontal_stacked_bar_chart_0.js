/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart_0",
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
  "background": "yes",

  "elementAlignment": "center",
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
    const rawData = data;
    const chartDataArray = rawData.data && rawData.data.data ? rawData.data.data : [];
    const config = rawData.variables || {};
    const typographyInput = rawData.typography || {};
    const colorsInput = rawData.colors || {};
    const imagesInput = rawData.images || {};
    const dataColumns = rawData.data && rawData.data.columns ? rawData.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldDef ? xFieldDef.name : undefined;
    const yFieldName = yFieldDef ? yFieldDef.name : undefined;
    const groupFieldName = groupFieldDef ? groupFieldDef.name : undefined;
    
    const yUnit = (yFieldDef && yFieldDef.unit && yFieldDef.unit !== "none") ? yFieldDef.unit : "";

    if (!xFieldName || !yFieldName || !groupFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push("x role field");
        if (!yFieldName) missingFields.push("y role field");
        if (!groupFieldName) missingFields.push("group role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    
    if (!chartDataArray || chartDataArray.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        // console.warn(errorMsg); // Use warn as it's a data issue, not config
        d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null; 
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {},
        images: {}
    };

    fillStyle.typography.title = {
        fontFamily: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
        fontSize: (typographyInput.title && typographyInput.title.font_size) || '16px',
        fontWeight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
    };
    fillStyle.typography.label = {
        fontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
        fontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
        fontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
    };
    fillStyle.typography.annotation = {
        fontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
        fontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
        fontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
    };

    fillStyle.colors.textColor = colorsInput.text_color || '#333333';
    fillStyle.colors.backgroundColor = colorsInput.background_color || '#FFFFFF';
    fillStyle.colors.primary = (colorsInput.other && colorsInput.other.primary) || '#1f77b4';
    fillStyle.colors.dataLabelOnBar = '#FFFFFF'; 

    const defaultCategoryColors = d3.schemeCategory10;
    fillStyle.colors.groupColorMap = colorsInput.field || {};
    fillStyle.colors.availableColors = (colorsInput.available_colors && colorsInput.available_colors.length > 0) 
                                       ? colorsInput.available_colors 
                                       : defaultCategoryColors;
    
    fillStyle.images.field = imagesInput.field || {};

    function estimateTextWidth(text, styleProps) {
        if (!text || !styleProps) return 0;
        const { fontFamily, fontSize, fontWeight } = styleProps;
        if (!fontFamily || !fontSize) return 0;

        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        if (fontWeight) {
            tempText.setAttribute('font-weight', fontWeight);
        }
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        const width = tempText.getBBox().width;
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.backgroundColor)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: config.marginTop || 50, // Default, can be overridden by legend height considerations
        right: config.marginRight ||30, 
        bottom: config.marginBottom || 80, 
        left: config.marginLeft || 200 
    };
    
    // Dynamic top margin adjustment for legend
    const legendMinTopPadding = 15; // Minimum padding above legend
    const legendPaddingBelowToChart = 15; // Space between legend and chart content area
    // Estimate legend height (simplified: assume 2 lines max for typical cases, or use a fixed portion of margin)
    // A more robust calculation would fully render legend items in memory first.
    // For this refactor, we'll use a fixed top margin, assuming it's sufficient.
    // The legend will be positioned relative to this margin.
    // The original code calculated legend height and adjusted its Y position.
    // `chartMargins.top` will be the start of the main chart group. Legend is above this.
    // If `config.marginTopForLegend` was used, it would be `chartMargins.top = config.marginTopForLegend || 100;`

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort(); 

    const groupedData = d3.group(chartDataArray, d => d[xFieldName]);
    const processedData = Array.from(groupedData, ([key, values]) => {
        const obj = { [xFieldName]: key }; 
        groups.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[yFieldName]);
        });
        obj.total = d3.sum(values, d => +d[yFieldName]);
        return obj;
    });
    
    const stack = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) 
        .offset(d3.stackOffsetNone);

    const stackedData = stack(processedData);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d[xFieldName]))
        .range([innerHeight, 0])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) || 0]) 
        .range([0, innerWidth])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((g, i) => 
            fillStyle.colors.groupColorMap[g] || 
            fillStyle.colors.availableColors[i % fillStyle.colors.availableColors.length]
        ));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10));
    
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll("text").remove(); // Replicate original behavior of removing X-axis text

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale)
            .tickSize(0)
            .tickPadding(10)
        );
    
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .style("font-family", fillStyle.typography.label.fontFamily)
        .style("font-size", fillStyle.typography.label.fontSize)
        .style("font-weight", fillStyle.typography.label.fontWeight)
        .style("fill", fillStyle.colors.textColor)
        .style("text-anchor", "end");

    const yAxisIconSize = yScale.bandwidth() * 0.7;
    const yAxisIconPadding = 10; // Space between icon and text, and icon and axis line

    yAxisGroup.selectAll(".tick").each(function(d) { 
        const tick = d3.select(this);
        const tickText = tick.select("text");
        const iconUrl = fillStyle.images.field[d]; // d is the xFieldName value for this tick

        if (iconUrl) {
            tick.append("image")
                .attr("class", "icon y-axis-icon")
                .attr("x", - (yScale.tickPadding() || 0) - yAxisIconPadding - yAxisIconSize) // Position left of text
                .attr("y", -yAxisIconSize / 2) 
                .attr("width", yAxisIconSize)
                .attr("height", yAxisIconSize)
                .attr("xlink:href", iconUrl);
            
            tickText.attr("x", - (yScale.tickPadding() || 0) - yAxisIconPadding * 2 - yAxisIconSize);
        }
    });

    if (groups && groups.length > 0) {
        const legendMarkerWidth = 12, legendMarkerHeight = 12, legendMarkerRx = 3, legendMarkerRy = 3;
        const legendPadding = 6, legendInterItemSpacing = 12;

        const legendItemsData = groups.map(group => {
            const text = String(group);
            const color = colorScale(group);
            const textWidth = estimateTextWidth(text, fillStyle.typography.label);
            return { text, color, visualWidth: legendMarkerWidth + legendPadding + textWidth };
        });

        const legendLines = [];
        let currentLineItems = [], currentLineVisualWidth = 0;
        const availableWidthForLegendWrapping = innerWidth;

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth + (currentLineItems.length > 0 ? legendInterItemSpacing : 0);
            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > availableWidthForLegendWrapping) {
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                currentLineItems = [item]; currentLineVisualWidth = item.visualWidth;
            } else {
                currentLineVisualWidth += widthIfAdded - (currentLineItems.length > 0 ? 0 : item.visualWidth); // Add spacing if not first item
                currentLineItems.push(item);
                if(currentLineItems.length === 1) currentLineVisualWidth = item.visualWidth; // Set initial width
            }
        });
        if (currentLineItems.length > 0) legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });

        if (legendLines.length > 0) {
            const itemMaxHeight = Math.max(legendMarkerHeight, parseFloat(fillStyle.typography.label.fontSize));
            const interLineVerticalPadding = 6;
            const totalLegendBlockHeight = legendLines.length * itemMaxHeight + Math.max(0, legendLines.length - 1) * interLineVerticalPadding;
            
            let legendBlockStartY = chartMargins.top - legendPaddingBelowToChart - totalLegendBlockHeight;
            legendBlockStartY = Math.max(legendMinTopPadding, legendBlockStartY);

            const legendContainerGroup = svgRoot.append("g").attr("class", "other legend-container");
            let currentLineBaseY = legendBlockStartY;

            legendLines.forEach(line => {
                const lineRenderStartX = (containerWidth - line.totalVisualWidth) / 2;
                const lineCenterY = currentLineBaseY + itemMaxHeight / 2;
                let currentItemDrawX = lineRenderStartX;

                line.items.forEach((item, itemIndex) => {
                    legendContainerGroup.append("rect")
                        .attr("class", "mark legend-mark")
                        .attr("x", currentItemDrawX).attr("y", currentLineBaseY + (itemMaxHeight - legendMarkerHeight) / 2)
                        .attr("width", legendMarkerWidth).attr("height", legendMarkerHeight)
                        .attr("rx", legendMarkerRx).attr("ry", legendMarkerRy).attr("fill", item.color);

                    legendContainerGroup.append("text")
                        .attr("class", "label text legend-label")
                        .attr("x", currentItemDrawX + legendMarkerWidth + legendPadding).attr("y", lineCenterY)
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.label.fontFamily)
                        .style("font-size", fillStyle.typography.label.fontSize)
                        .style("font-weight", fillStyle.typography.label.fontWeight)
                        .style("fill", fillStyle.colors.textColor).text(item.text);
                    if (itemIndex < line.items.length - 1) currentItemDrawX += item.visualWidth + legendInterItemSpacing;
                });
                currentLineBaseY += itemMaxHeight + interLineVerticalPadding;
            });

            if (groupFieldName) {
                 svgRoot.append("text")
                    .attr("class", "label text legend-title")
                    .attr("x", containerWidth / 2).attr("y", legendBlockStartY - 10)
                    .attr("text-anchor", "middle").attr("dominant-baseline", "alphabetic")
                    .style("font-family", fillStyle.typography.title.fontFamily)
                    .style("font-size", fillStyle.typography.title.fontSize)
                    .style("font-weight", fillStyle.typography.title.fontWeight)
                    .style("fill", fillStyle.colors.textColor).text(groupFieldName);
            }
        }
    }

    // Block 8: Main Data Visualization Rendering
    const barLayers = mainChartGroup.selectAll(".bar-layer-group")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `mark group-layer layer-${String(d.key).replace(/\s+/g, '-').toLowerCase()}`)
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll(".bar-segment")
        .data(d => d.map(item => ({ ...item, key: d.key })))
        .enter().append("rect")
        .attr("class", "mark bar-segment")
        .attr("y", d => yScale(d.data[xFieldName]))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => Math.max(0, xScale(d[1]) - xScale(d[0])))
        .attr("height", yScale.bandwidth());

    barLayers.selectAll(".data-label")
        .data(d => d.map(item => ({ ...item, key: d.key })))
        .enter().append("text")
        .attr("class", "label value data-label")
        .attr("y", d => yScale(d.data[xFieldName]) + yScale.bandwidth() / 2)
        .attr("x", d => xScale(d[0]) + (xScale(d[1]) - xScale(d[0])) / 2)
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .style("fill", fillStyle.colors.dataLabelOnBar)
        .style("font-family", fillStyle.typography.annotation.fontFamily)
        .style("font-size", fillStyle.typography.annotation.fontSize)
        .style("font-weight", fillStyle.typography.annotation.fontWeight)
        .text(d => {
            const value = d[1] - d[0];
            if (value === 0) return "";
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            const formattedText = `${formatValue(value)}${yUnit}`;
            const textWidth = estimateTextWidth(formattedText, fillStyle.typography.annotation);
            return (segmentWidth > textWidth && value > 0) ? formattedText : '';
        });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactor)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
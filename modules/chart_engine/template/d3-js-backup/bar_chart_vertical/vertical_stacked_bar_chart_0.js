/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Stacked Bar Chart",
  "chart_name": "vertical_stacked_bar_chart_0",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 12], [0, "inf"], [3, 20]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming data.colors, not data.colors_dark for simplicity
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldCol ? xFieldCol.name : undefined;
    const yFieldName = yFieldCol ? yFieldCol.name : undefined;
    const groupFieldName = groupFieldCol ? groupFieldCol.name : undefined;

    const yFieldUnit = yFieldCol && yFieldCol.unit !== "none" ? yFieldCol.unit : "";

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x role field" : null,
            !yFieldName ? "y role field" : null,
            !groupFieldName ? "group role field" : null
        ].filter(Boolean).join(", ");
        
        const errorMessage = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 14px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) || '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) || 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        },
        textColor: colors.text_color || '#333333',
        chartBackground: colors.background_color || '#FFFFFF', // SVG background
        dataLabelColorOnBar: '#FFFFFF', // Default white for labels on bars
        defaultBarColor: (colors.other && colors.other.primary) || '#1f77b4',
        // Color resolution for bars will be handled by colorScale using colors.field, colors.available_colors, or d3.schemeCategory10
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight = 'normal') {
        const context = document.createElement('canvas').getContext('2d');
        context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        return context.measureText(text).width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
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
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 60, // Increased top margin for legend
        right: variables.margin_right || 30,
        bottom: variables.margin_bottom || 80, // For potentially rotated x-axis labels
        left: variables.margin_left || 50
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartDataInput.map(d => d[groupFieldName]))).sort(); // Sort for consistent legend order

    const processedData = Array.from(d3.group(chartDataInput, d => d[xFieldName]), ([key, values]) => {
        const obj = { [xFieldName]: key };
        groups.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[yFieldName]);
        });
        obj.total = d3.sum(values, d => +d[yFieldName]);
        return obj;
    });
    
    // Sort processedData by xFieldName if it's sortable (e.g. if x-axis represents time or ordered categories)
    // For generic categorical data, the original order from d3.group is usually fine.
    // If specific order is needed, it should be handled based on data properties or configuration.

    const stack = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) // Keep original group order for stacking
        .offset(d3.stackOffsetNone);

    const stackedData = stack(processedData);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d[xFieldName]))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) || 1]) // Ensure domain is at least [0,1]
        .range([innerHeight, 0])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (colors.field && colors.field[group]) {
                return colors.field[group];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[i % colors.available_colors.length];
            }
            return d3.schemeCategory10[i % d3.schemeCategory10.length]; // Fallback to d3.schemeCategory10
        }));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // X-Axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10))
        .call(g => g.select(".domain").remove());

    // X-Axis Label Rotation Logic
    let rotateXLabels = false;
    const maxAllowedLabelWidth = xScale.bandwidth();
    xAxisGroup.selectAll("text.label, text") // d3 v5+ uses text, older might use text.label
        .each(function(d) {
            const labelText = String(d);
            const estimatedWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            if (estimatedWidth > maxAllowedLabelWidth) {
                rotateXLabels = true;
            }
        })
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label") // Standardized class
        .style("text-anchor", rotateXLabels ? "end" : "middle")
        .attr("dx", rotateXLabels ? "-.8em" : null)
        .attr("dy", rotateXLabels ? ".15em" : null)
        .attr("transform", rotateXLabels ? "rotate(-45)" : "rotate(0)");


    // Legend
    if (groups.length > 0) {
        const legendContainerGroup = svgRoot.append("g")
            .attr("class", "legend");

        const legendItemHeight = 20;
        const legendRectSize = 12;
        const legendSpacing = 5; // Spacing between rect and text
        const legendItemPadding = 10; // Spacing between legend items

        let currentX = 0;
        const legendItems = [];

        // Legend Title (Group Field Name)
        if (groupFieldName && groups.length > 1) { // Only show legend title if there are multiple groups
             const legendTitleWidth = estimateTextWidth(
                groupFieldName + ":", 
                fillStyle.typography.labelFontFamily, 
                fillStyle.typography.labelFontSize, 
                fillStyle.typography.labelFontWeight
            );
            legendItems.push({type: 'title', text: groupFieldName + ":", width: legendTitleWidth});
            currentX += legendTitleWidth + legendItemPadding;
        }


        groups.forEach(group => {
            const itemText = String(group);
            const textWidth = estimateTextWidth(
                itemText, 
                fillStyle.typography.labelFontFamily, 
                fillStyle.typography.labelFontSize,
                fillStyle.typography.labelFontWeight
            );
            const itemWidth = legendRectSize + legendSpacing + textWidth;
            legendItems.push({type: 'item', text: itemText, color: colorScale(group), width: itemWidth, name: group});
            currentX += itemWidth + legendItemPadding;
        });
        
        const totalLegendWidth = legendItems.reduce((sum, item) => sum + item.width + (item.type === 'item' ? legendItemPadding : (item.type === 'title' ? legendItemPadding : 0)), 0) - (legendItems.length > 0 ? legendItemPadding : 0) ;


        let legendOffsetX = (containerWidth - totalLegendWidth) / 2;
        const legendOffsetY = chartMargins.top / 2 - legendItemHeight / 2; // Vertically center in top margin space

        legendOffsetX = Math.max(legendOffsetX, chartMargins.left); // Ensure legend doesn't go off left edge

        let accumulatedX = 0;
        legendItems.forEach(item => {
            const g = legendContainerGroup.append("g")
                .attr("transform", `translate(${legendOffsetX + accumulatedX}, ${legendOffsetY})`);

            if (item.type === 'title') {
                g.append("text")
                    .attr("class", "label legend-title")
                    .attr("x", 0)
                    .attr("y", legendRectSize / 2)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(item.text);
                accumulatedX += item.width + legendItemPadding;
            } else { // type 'item'
                g.append("rect")
                    .attr("class", "mark legend-swatch")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", legendRectSize)
                    .attr("height", legendRectSize)
                    .style("fill", item.color);

                g.append("text")
                    .attr("class", "label legend-label")
                    .attr("x", legendRectSize + legendSpacing)
                    .attr("y", legendRectSize / 2)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(item.text);
                accumulatedX += item.width + legendItemPadding;
            }
        });
    }


    // Block 8: Main Data Visualization Rendering
    const barLayers = mainChartGroup.selectAll(".layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `layer mark group-${String(d.key).replace(/\s+/g, '-')}`) // Add class for group
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll("rect")
        .data(d => d.map(s => ({...s, key: d.key}))) // Add key to individual segment data for access
        .enter().append("rect")
        .attr("class", "mark bar-segment")
        .attr("x", d => xScale(d.data[xFieldName]))
        .attr("y", d => yScale(d[1]))
        .attr("height", d => {
            const h = yScale(d[0]) - yScale(d[1]);
            return h > 0 ? h : 0; // Ensure non-negative height
        })
        .attr("width", xScale.bandwidth());

    // Data Labels on Bars
    barLayers.selectAll("text.data-label")
        .data(d => d.map(s => ({...s, key: d.key})))
        .enter().append("text")
        .attr("class", "label data-label")
        .attr("x", d => xScale(d.data[xFieldName]) + xScale.bandwidth() / 2)
        .attr("y", d => {
            const barSegmentHeight = yScale(d[0]) - yScale(d[1]);
            return yScale(d[1]) + barSegmentHeight / 2;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.dataLabelColorOnBar)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => {
            const value = d[1] - d[0];
            const barSegmentHeight = yScale(d[0]) - yScale(d[1]);
            // Only show if segment height is sufficient and value is non-zero
            if (barSegmentHeight > (parseFloat(fillStyle.typography.annotationFontSize) || 10) && value !== 0) {
                return formatValue(value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            }
            return '';
        });

    // Block 9: Optional Enhancements & Post-Processing
    // (X-axis label rotation handled in Block 7)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
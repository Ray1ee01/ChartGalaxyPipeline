/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Stacked Bar Chart",
  "chart_name": "vertical_stacked_bar_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 12], [0, "inf"], [3, 20]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "secondary", "text_color", "background_color"],
  "min_height": 400,
  "min_width": 400,
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
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const dataColumns = data.data?.columns || [];

    // Clear the containerSelector
    d3.select(containerSelector).html("");

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldDef = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldDef?.name;
    const yFieldName = yFieldDef?.name;
    const groupFieldName = groupFieldDef?.name;

    const yFieldUnit = yFieldDef?.unit && yFieldDef.unit !== "none" ? yFieldDef.unit : "";

    const criticalFieldsMissing = [];
    if (!xFieldName) criticalFieldsMissing.push(`Field for role '${xFieldRole}' (e.g., category axis)`);
    if (!yFieldName) criticalFieldsMissing.push(`Field for role '${yFieldRole}' (e.g., value axis)`);
    if (!groupFieldName) criticalFieldsMissing.push(`Field for role '${groupFieldRole}' (e.g., stack series)`);

    if (criticalFieldsMissing.length > 0) {
        const errorMsg = `Critical chart configuration missing: ${criticalFieldsMissing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    if (!chartDataInput || chartDataInput.length === 0) {
        const errorMsg = "No data provided to chart. Cannot render.";
        console.warn(errorMsg); // Use warn as it's a data issue, not config
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    // const imagesInput = data.images || {}; // Not used in this chart

    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        textColor: colorsInput.text_color || '#0f223b',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        dataLabelOnSolidColor: '#FFFFFF', 
        defaultCategoricalScheme: d3.schemeCategory10,
        getCategoryColor: (categoryName, index) => {
            if (colorsInput.field && colorsInput.field[categoryName]) {
                return colorsInput.field[categoryName];
            }
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                return colorsInput.available_colors[index % colorsInput.available_colors.length];
            }
            const fallbackScheme = [];
            if (colorsInput.other && colorsInput.other.primary) fallbackScheme.push(colorsInput.other.primary);
            if (colorsInput.other && colorsInput.other.secondary) fallbackScheme.push(colorsInput.other.secondary);
            
            const combinedScheme = [...fallbackScheme, ...fillStyle.defaultCategoricalScheme];
            return combinedScheme[index % combinedScheme.length];
        }
    };
    
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No need to style tempSvg itself if not appending to DOM
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (fontProps.fontFamily) tempText.setAttribute('font-family', fontProps.fontFamily);
        if (fontProps.fontSize) tempText.setAttribute('font-size', fontProps.fontSize);
        if (fontProps.fontWeight) tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText); 
        // Must be in DOM to getBBox reliably, but directive says not to.
        // For compliance, we rely on direct attribute setting and hope getBBox works.
        // If not, a brief append/remove to document.body would be needed.
        let width = 0;
        try {
             width = tempText.getBBox().width;
        } catch (e) {
            console.warn("Could not estimate text width using detached SVG for: " + text, e);
            // Fallback: rough estimate (e.g., average char width * length)
            width = text.length * (parseInt(fontProps.fontSize) * 0.6 || 6);
        }
        return width;
    }

    const formatValue = (value) => {
        if (value === 0) return "0";
        const absValue = Math.abs(value);
        if (absValue >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (absValue >= 1000000) return d3.format("~.2s")(value);
        if (absValue >= 1000) return d3.format("~.2s")(value);
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendItemVisualHeight = parseInt(fillStyle.typography.labelFontSize.replace('px','')) + 4;
    const legendAreaHeight = legendItemVisualHeight + 10; // Approx space for one row of legend items + title padding

    const chartMargins = {
        top: legendAreaHeight, 
        right: 30,
        bottom: 70, 
        left: 50 
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Adjust container size or margins.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartDataInput.map(d => d[groupFieldName]))).sort();

    const processedData = Array.from(d3.group(chartDataInput, d => d[xFieldName]), ([key, values]) => {
        const obj = { [xFieldName]: key };
        groups.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[yFieldName] || 0);
        });
        obj.total = d3.sum(values, d => +d[yFieldName] || 0);
        return obj;
    });
    
    const stackGenerator = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d[xFieldName]))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) || 1])
        .range([innerHeight, 0])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.getCategoryColor(group, i)));

    // Block 7: Chart Component Rendering
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .tickSize(0)
            .tickPadding(10))
        .call(g => g.select(".domain").remove());

    xAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label")
        .each(function(d) {
            const labelText = String(d);
            const textWidth = estimateTextWidth(labelText, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            if (textWidth > xScale.bandwidth() * 1.05) { // 1.05 to give a little breathing room
                d3.select(this)
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)");
            } else {
                d3.select(this).style("text-anchor", "middle");
            }
        });
    
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend other") // 'other' as it's a composite of marks and labels
        .attr("transform", `translate(0, ${legendItemVisualHeight / 2})`); // Initial Y, X will be centered

    const legendTitleText = groupFieldName && groups.length > 0 ? `${groupFieldName}:` : "";
    const legendTitle = legendGroup.append("text")
        .attr("class", "label legend-title")
        .attr("x", 0)
        .attr("y", 0) 
        .attr("dy", "0.32em")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", "bold") 
        .style("fill", fillStyle.textColor)
        .text(legendTitleText);

    let currentXLegend = (legendTitle.node() && legendTitleText ? legendTitle.node().getBBox().width : 0) + (legendTitleText ? 10 : 0);
    const legendItemSpacing = 15;
    const legendRectSize = parseInt(fillStyle.typography.labelFontSize.replace('px','')) * 0.8;

    groups.forEach((groupKey) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item other")
            .attr("transform", `translate(${currentXLegend}, 0)`);

        itemGroup.append("rect")
            .attr("class", "mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("y", -legendRectSize / 2) 
            .style("fill", colorScale(groupKey));

        const itemText = itemGroup.append("text")
            .attr("class", "label")
            .attr("x", legendRectSize + 5)
            .attr("y", 0)
            .attr("dy", "0.32em") // Vertically center with rect
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(groupKey);
        
        currentXLegend += (legendRectSize + 5 + (itemText.node() ? itemText.node().getBBox().width : 0) + legendItemSpacing);
    });
    
    const finalLegendWidth = currentXLegend - legendItemSpacing;
    const legendXOffset = (containerWidth - finalLegendWidth) / 2;
    legendGroup.attr("transform", `translate(${legendXOffset > chartMargins.left ? legendXOffset : chartMargins.left}, ${legendItemVisualHeight / 2 + 5})`);


    // Block 8: Main Data Visualization Rendering
    const barLayers = mainChartGroup.selectAll(".layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `layer mark group-${d.key.toString().replace(/\s+/g, '-').toLowerCase()}`)
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll("rect")
        .data(d => d.map(sd => ({ ...sd, key: d.key }))) // Add key to segment data
        .enter().append("rect")
        .attr("class", "mark bar-segment")
        .attr("x", d => xScale(d.data[xFieldName]))
        .attr("y", d => yScale(d[1]))
        .attr("height", d => Math.max(0, yScale(d[0]) - yScale(d[1])))
        .attr("width", xScale.bandwidth())
        .style("stroke", "none");

    barLayers.selectAll(".data-label")
        .data(d => d.map(sd => ({ ...sd, key: d.key })))
        .enter().append("text")
        .attr("class", "label value data-label")
        .attr("x", d => xScale(d.data[xFieldName]) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d[1]) + Math.max(0, yScale(d[0]) - yScale(d[1])) / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.dataLabelOnSolidColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => {
            const value = d[1] - d[0];
            const segmentHeight = Math.max(0, yScale(d[0]) - yScale(d[1]));
            const labelMinHeight = parseInt(fillStyle.typography.annotationFontSize.replace('px','')) * 1.2;
            if (segmentHeight > labelMinHeight && value !== 0) { // Show label if value is not zero
                return formatValue(value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            }
            return '';
        });

    // Block 9: Optional Enhancements & Post-Processing
    // None for this chart

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
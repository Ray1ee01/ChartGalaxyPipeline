/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_5",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal bar chart.
    // Category labels are placed below the bars, value labels to the right.
    // Bars are sorted in descending order of value.

    // Block 1: Configuration Parsing & Validation
    const chartRawData = data.data?.data;
    const configVariables = data.variables || {};
    const configTypography = data.typography || {};
    const configColors = data.colors || {};
    // const configImages = data.images || {}; // Not used in this chart
    const dataColumnsDefinition = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumnsDefinition.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumnsDefinition.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field (category)");
        if (!valueFieldName) missingFields.push("y role field (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (!chartRawData || chartRawData.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldUnit = dataColumnsDefinition.find(col => col.role === "x")?.unit || "none";
    const valueFieldUnit = dataColumnsDefinition.find(col => col.role === "y")?.unit || "none";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryBarColor: (configColors.other && configColors.other.primary) ? configColors.other.primary : '#007bff',
        textColor: configColors.text_color || '#333333',
        chartBackground: configColors.background_color || '#FFFFFF',
        typography: {
            labelFontFamily: (configTypography.label && configTypography.label.font_family) ? configTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (configTypography.label && configTypography.label.font_size) ? configTypography.label.font_size : '12px',
            labelFontWeight: (configTypography.label && configTypography.label.font_weight) ? configTypography.label.font_weight : 'normal',
            annotationFontFamily: (configTypography.annotation && configTypography.annotation.font_family) ? configTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (configTypography.annotation && configTypography.annotation.font_size) ? configTypography.annotation.font_size : '12px',
            annotationFontWeight: (configTypography.annotation && configTypography.annotation.font_weight) ? configTypography.annotation.font_weight : 'normal',
        }
    };

    function estimateTextDimensions(text, fontProps) {
        if (!text) return { width: 0, height: 0 };
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        tempTextElement.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        tempTextElement.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // getBBox requires the element to be in the DOM for some browsers,
        // but prompt strictly forbids appending to document DOM for this helper.
        // Assuming current browser environment supports getBBox on in-memory SVG.
        try {
            const bbox = tempTextElement.getBBox();
            return { width: bbox.width, height: bbox.height };
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            // This is a rough estimate.
            const fontSizePx = parseFloat(fontProps.fontSize || fillStyle.typography.labelFontSize);
            return { width: text.length * fontSizePx * 0.6, height: fontSizePx };
        }
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (value >= 1000000000) {
            return d3.format("~.2s")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~.2s")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~.2s")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    };
    
    const minLabelFontSize = 6; // Minimum font size for labels

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = configVariables.width || 800;
    let containerHeight = configVariables.height || 600; // Initial height, may be adjusted

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight) // Will be updated if height is dynamic
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-visualization-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartDataArray = [...chartRawData].map(d => ({
        ...d,
        [valueFieldName]: parseFloat(d[valueFieldName]) || 0 // Ensure value is a number
    }));
    
    const sortedData = chartDataArray.sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedCategories = sortedData.map(d => d[categoryFieldName]);

    const numCategories = sortedCategories.length;
    const originalHeightProvided = configVariables.height || 600;
    const maxHeightFactor = 1.88;

    if (numCategories > 18 && originalHeightProvided) {
        const suggestedHeight = originalHeightProvided * (numCategories / 18);
        containerHeight = Math.min(suggestedHeight, originalHeightProvided * maxHeightFactor);
        svgRoot.attr("height", containerHeight); // Update SVG height
    }
    
    let maxValueLabelWidth = 0;
    sortedData.forEach(d => {
        const valueText = valueFieldUnit !== "none" ?
            `${formatValue(d[valueFieldName])}${valueFieldUnit}` :
            formatValue(d[valueFieldName]);
        const textWidth = estimateTextDimensions(valueText, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        }).width;
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });

    const chartMargins = {
        top: configVariables.margin_top || 20,
        right: configVariables.margin_right || Math.max(20, maxValueLabelWidth + 15), // Ensure space for value labels
        bottom: configVariables.margin_bottom || 30, // Base bottom margin, category labels might extend this
        left: configVariables.margin_left || 20
    };
    
    // Estimate max category label height to adjust bottom margin
    const tempCategoryLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const estMaxCategoryLabelHeight = estimateTextDimensions(" Αγ ", { // Sample text with descender
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: tempCategoryLabelFontSize + 'px',
        fontWeight: fillStyle.typography.labelFontWeight
    }).height;
    chartMargins.bottom = Math.max(chartMargins.bottom, estMaxCategoryLabelHeight + 5);


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Adjust margins or container size.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    // Sorting and category extraction already done in Block 4 for height calculation.

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(0.4); // Fixed padding

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => d[valueFieldName]) || 1]) // Ensure domain max is at least 1
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (No explicit axes/gridlines for this style)
    // Category and value labels are rendered with bars in Block 8.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const barHeight = yScale.bandwidth();
    
    // Calculate optimal font size for category labels to fit below bars
    const spaceForCategoryLabel = yScale.step() - barHeight; // Space between bottom of one bar and top of next bar's band
    let categoryLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    
    if (spaceForCategoryLabel > 0) { // Only adjust if there's actual space
        const estimatedHeightForDefaultSize = estimateTextDimensions("Sample", {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: categoryLabelFontSize + 'px',
            fontWeight: fillStyle.typography.labelFontWeight
        }).height;

        if (estimatedHeightForDefaultSize > spaceForCategoryLabel - 2) { // -2 for padding
            categoryLabelFontSize = Math.floor(spaceForCategoryLabel - 2);
        }
        categoryLabelFontSize = Math.max(minLabelFontSize, categoryLabelFontSize);
    } else {
        categoryLabelFontSize = minLabelFontSize; // Fallback if no space
    }


    sortedData.forEach(d => {
        const category = d[categoryFieldName];
        const value = d[valueFieldName];

        const barGroup = mainChartGroup.append("g")
            .attr("transform", `translate(0, ${yScale(category)})`)
            .attr("class", "bar-item-group");

        // Render Bar
        barGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", xScale(value))
            .attr("height", barHeight)
            .attr("fill", fillStyle.primaryBarColor);

        // Render Category Label (below the bar)
        const categoryLabelY = barHeight + 2; // 2px padding below bar
        const categoryText = categoryFieldUnit !== "none" ? `${category}${categoryFieldUnit}` : `${category}`;
        
        barGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", 0)
            .attr("y", categoryLabelY)
            .attr("dy", "0.71em") // To align text nicely from its baseline
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", categoryLabelFontSize + "px")
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryText);

        // Render Value Label (to the right of the bar)
        const valueText = valueFieldUnit !== "none" ?
            `${formatValue(value)}${valueFieldUnit}` :
            formatValue(value);
        
        let valueLabelFontSize = parseFloat(fillStyle.typography.annotationFontSize);
        // Dynamic font size for value label based on bar height
        valueLabelFontSize = Math.min(20, Math.max(barHeight * 0.6, valueLabelFontSize));
        valueLabelFontSize = Math.max(minLabelFontSize, valueLabelFontSize);


        barGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", xScale(value) + 5) // 5px padding from bar end
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em") // Vertical centering
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", valueLabelFontSize + "px")
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
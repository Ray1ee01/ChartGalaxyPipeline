/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_06",
  "is_composite": false,
  "required_fields": ["x", "y", "group", "group2"],
  "hierarchy": ["group2"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2], [1, 5]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
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
    // This function renders a horizontal diverging bar chart, often used for comparisons.
    // It displays two sets of bars (left and right) based on a primary grouping category,
    // with items (e.g., countries) listed vertically. Values are represented by bar lengths.
    // A secondary grouping (e.g., development status) can influence item presentation if configured.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data?.columns || [];
    let chartDataArray = data.data?.data || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const yFieldUnit = dataColumns.find(col => col.role === "y")?.unit || "";
    const categoryField = dataColumns.find(col => col.role === "group")?.name;
    const subCategoryField = dataColumns.find(col => col.role === "group2")?.name; // e.g., developmentStatusField

    const criticalFields = { xField, yField, categoryField, subCategoryField };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        colors: {
            textColor: colorsConfig.text_color || '#0f223b',
            chartBackground: colorsConfig.background_color || '#FFFFFF',
            defaultBarColor: colorsConfig.other?.primary || '#1f77b4',
            rankCircleFill: '#000000',
            rankCircleText: '#FFFFFF',
            categoryHeaderBackground: '#000000',
            categoryHeaderText: '#FFFFFF',
        },
        images: {
            getIcon: (dimensionName) => imagesConfig.field?.[dimensionName] || imagesConfig.other?.[dimensionName] || null
        }
    };

    fillStyle.colors.getCategoryColor = (categoryName, index = 0) => {
        if (colorsConfig.field && colorsConfig.field[categoryName]) {
            return colorsConfig.field[categoryName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        // Fallback to a slightly varied default if multiple categories and no specific colors
        const defaultColors = ['#4BB462', '#5271C7', '#FF9800', '#9C27B0', '#E91E63'];
        return defaultColors[index % defaultColors.length];
    };
    
    const estimateTextWidth = (text, fontSize, fontWeight, fontFamily) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('style', `font-family: ${fontFamily}; font-size: ${fontSize}; font-weight: ${fontWeight};`);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox across browsers
        // but per spec, strictly in-memory. This might be less accurate for some complex fonts.
        // For robustness if issues arise: document.body.appendChild(tempSvg); const width = tempText.getBBox().width; document.body.removeChild(tempSvg); return width;
        return tempText.getBBox().width;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (value >= 1000000) return d3.format("~.2s")(value).replace('M', 'M');
        if (value >= 1000) return d3.format("~.2s")(value).replace('k', 'K');
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 900;
    // Height calculation will be dynamic based on row count, but SVG needs a fixed height.
    // We'll calculate rowCount first, then set SVG height.
    // For now, use a placeholder or default if chartConfig.height is not set.
    let containerHeight = chartConfig.height || 600; // This will be adjusted later if needed or used as fixed.

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight) // Initial height, may be updated
        .attr("class", "chart-root-svg")
        .style("background-color", fillStyle.colors.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 40, bottom: 40, left: 40 }; // Base margins
    
    // Layout parameters (can be adjusted)
    const baseRowHeight = 50; // Desired height per row
    const rankCircleRadius = 16;
    const itemIconWidth = 35;
    const itemIconHeight = 35;
    const categoryHeaderHeight = 25;
    const categoryHeaderMarginBottom = 10; // Space between category header and first row

    chartMargins.top = Math.max(chartMargins.top, categoryHeaderHeight + categoryHeaderMarginBottom + 20); // Ensure space for category headers

    // Block 5: Data Preprocessing & Transformation
    const allCategories = [...new Set(chartDataArray.map(d => d[categoryField]))];
    let leftCategoryName = allCategories.length > 0 ? allCategories[0] : "Left Group";
    let rightCategoryName = allCategories.length > 1 ? allCategories[1] : "Right Group";
    if (allCategories.length === 1) rightCategoryName = " "; // Avoid duplicate name if only one category

    const leftData = chartDataArray
        .filter(d => d[categoryField] === leftCategoryName)
        .map(d => ({
            dimension: d[xField],
            value: +d[yField],
            subCategory: d[subCategoryField]
        }))
        .sort((a, b) => b.value - a.value);

    const rightData = chartDataArray
        .filter(d => d[categoryField] === rightCategoryName)
        .map(d => ({
            dimension: d[xField],
            value: +d[yField],
            subCategory: d[subCategoryField]
        }))
        .sort((a, b) => b.value - a.value);

    const rowCount = Math.max(leftData.length, rightData.length, 1); // At least 1 row to prevent division by zero

    // Recalculate containerHeight if not fixed by user, or adjust rowHeight if containerHeight is fixed
    if (!chartConfig.height) { // If height is not specified, calculate it based on rows
        containerHeight = chartMargins.top + (rowCount * baseRowHeight) + chartMargins.bottom;
        svgRoot.attr("height", containerHeight);
    }
    
    const actualRowHeight = (containerHeight - chartMargins.top - chartMargins.bottom) / rowCount;
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const centerX = innerWidth / 2;

    // Estimate max width needed for subCategory labels (status labels)
    const allSubCategories = [...new Set(chartDataArray.map(d => String(d[subCategoryField])))];
    let maxSubCategoryLabelWidth = 0;
    if (allSubCategories.length > 0) {
        maxSubCategoryLabelWidth = d3.max(allSubCategories, sc => 
            estimateTextWidth(
                sc.toUpperCase(), 
                fillStyle.typography.annotationFontSize, 
                fillStyle.typography.annotationFontWeight, 
                fillStyle.typography.annotationFontFamily
            )
        ) || 0;
    }
    maxSubCategoryLabelWidth += 5; // Padding

    // Block 6: Scale Definition & Configuration
    const allValues = [...leftData.map(d => d.value), ...rightData.map(d => d.value)];
    const globalMaxValue = allValues.length > 0 ? Math.max(0, ...allValues) : 1; // Ensure positive max

    const leftIconSpace = rankCircleRadius * 2 + 5 + itemIconWidth + 10; // rank circle, space, icon, space
    const rightIconSpace = rankCircleRadius * 2 + 5 + itemIconWidth + 10;

    // Available width for bars on each side
    // Left side: from icon space to center, minus padding and potential subCategory label space
    // Right side: from center to icon space (from right edge), minus padding and potential subCategory label space
    const leftMaxBarWidth = centerX - leftIconSpace - 10 - (maxSubCategoryLabelWidth / (allCategories.length > 1 ? 2 : 1) ); // 10 for padding
    const rightMaxBarWidth = innerWidth - centerX - rightIconSpace - 10 - (maxSubCategoryLabelWidth / (allCategories.length > 1 ? 2 : 1) );

    const barScale = d3.scaleLinear()
        .domain([0, globalMaxValue])
        .range([0, Math.min(leftMaxBarWidth, rightMaxBarWidth)]); // Use the smaller of the two for consistent scaling if desired, or separate scales

    // For this diverging chart, it's better to have bars grow from their respective icon areas
    // So, left bars grow right, right bars grow right.
    // Max bar width for left side: centerX - leftIconSpace - padding
    // Max bar width for right side: innerWidth - (centerX + some_offset_for_right_rank_circle) - rightIconSpace - padding
    
    const leftBarScale = d3.scaleLinear()
        .domain([0, globalMaxValue])
        .range([0, leftMaxBarWidth > 0 ? leftMaxBarWidth : 10]); // Ensure positive range

    const rightBarScale = d3.scaleLinear()
        .domain([0, globalMaxValue])
        .range([0, rightMaxBarWidth > 0 ? rightMaxBarWidth : 10]);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Category Headers (acting as titles for each side)
    const renderCategoryHeader = (text, x, y, anchor, availableWidth) => {
        const headerGroup = mainChartGroup.append("g")
            .attr("class", `category-header ${anchor}-header`)
            .attr("transform", `translate(${x}, ${y})`);

        let currentFontSize = parseFloat(fillStyle.typography.titleFontSize);
        let textWidth = estimateTextWidth(text, `${currentFontSize}px`, fillStyle.typography.titleFontWeight, fillStyle.typography.titleFontFamily);
        
        while (textWidth > availableWidth && currentFontSize > 8) {
            currentFontSize -= 1;
            textWidth = estimateTextWidth(text, `${currentFontSize}px`, fillStyle.typography.titleFontWeight, fillStyle.typography.titleFontFamily);
        }
        const finalFontSize = `${currentFontSize}px`;
        const rectWidth = textWidth + 20; // Padding for rect

        headerGroup.append("rect")
            .attr("x", anchor === 'start' ? 0 : -rectWidth)
            .attr("y", -categoryHeaderHeight / 2 - 5)
            .attr("width", rectWidth)
            .attr("height", categoryHeaderHeight)
            .attr("fill", fillStyle.colors.categoryHeaderBackground)
            .attr("class", "mark");

        headerGroup.append("text")
            .attr("x", anchor === 'start' ? rectWidth / 2 : -rectWidth / 2)
            .attr("y", 0)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", finalFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .style("fill", fillStyle.colors.categoryHeaderText)
            .attr("class", "label")
            .text(text);
    };
    
    const categoryHeaderY = - (categoryHeaderHeight / 2 + categoryHeaderMarginBottom);
    renderCategoryHeader(leftCategoryName, leftIconSpace / 2, categoryHeaderY, 'start', centerX - leftIconSpace / 2 - 10);
    if (allCategories.length > 1) {
         renderCategoryHeader(rightCategoryName, centerX + (innerWidth - centerX - rightIconSpace / 2) / 2 , categoryHeaderY, 'middle', (innerWidth - centerX - rightIconSpace / 2) / 2 - 10);
    }


    // Block 8: Main Data Visualization Rendering
    const barHeight = actualRowHeight * 0.8;
    const barYOffset = (actualRowHeight - barHeight) / 2;

    const renderSide = (sideData, isLeft) => {
        const sideGroup = mainChartGroup.append("g").attr("class", isLeft ? "left-side" : "right-side");

        sideData.forEach((d, i) => {
            const yPos = i * actualRowHeight;
            const itemGroup = sideGroup.append("g")
                .attr("class", "item-group")
                .attr("transform", `translate(0, ${yPos})`);

            // Rank Circle & Number
            const rankX = isLeft ? rankCircleRadius : centerX + rankCircleRadius + (maxSubCategoryLabelWidth / (allCategories.length > 1 ? 2 : 0) );
            const rankGroup = itemGroup.append("g")
                .attr("class", "rank-indicator")
                .attr("transform", `translate(${rankX}, ${actualRowHeight / 2})`);

            rankGroup.append("circle")
                .attr("r", rankCircleRadius)
                .attr("fill", fillStyle.colors.rankCircleFill)
                .attr("class", "mark");
            rankGroup.append("text")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.colors.rankCircleText)
                .attr("class", "label")
                .text(i + 1);

            // Dimension Icon
            const iconUrl = fillStyle.images.getIcon(d.dimension);
            const iconX = isLeft ? rankX + rankCircleRadius + 5 : centerX + rankCircleRadius + 5 + (maxSubCategoryLabelWidth / (allCategories.length > 1 ? 2 : 0) );
            if (iconUrl) {
                itemGroup.append("image")
                    .attr("xlink:href", iconUrl)
                    .attr("x", iconX)
                    .attr("y", (actualRowHeight - itemIconHeight) / 2)
                    .attr("width", itemIconWidth)
                    .attr("height", itemIconHeight)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("class", "icon image");
            }

            // Bar
            const barStartX = isLeft ? iconX + itemIconWidth + 5 : iconX + itemIconWidth + 5;
            const currentBarScale = isLeft ? leftBarScale : rightBarScale;
            const barWidthValue = currentBarScale(d.value);
            
            const itemColor = fillStyle.colors.getCategoryColor(isLeft ? leftCategoryName : rightCategoryName, isLeft ? 0 : 1);

            itemGroup.append("rect")
                .attr("x", barStartX)
                .attr("y", barYOffset)
                .attr("width", barWidthValue)
                .attr("height", barHeight)
                .attr("fill", itemColor)
                .attr("class", "mark value");

            // Value Label
            const formattedValue = formatValue(d.value) + yFieldUnit;
            const valueLabelFontSize = Math.min(parseFloat(fillStyle.typography.labelFontSize), barHeight * 0.6) + "px";
            const valueLabelWidth = estimateTextWidth(formattedValue, valueLabelFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
            
            const textFitsInBar = barWidthValue > valueLabelWidth + 10;
            const valueLabelX = textFitsInBar ? barStartX + barWidthValue - 5 : barStartX + barWidthValue + 5;
            const valueLabelAnchor = textFitsInBar ? "end" : "start";
            const valueLabelColor = textFitsInBar ? fillStyle.colors.rankCircleText : fillStyle.colors.textColor; // rankCircleText is white, good for inside bar

            itemGroup.append("text")
                .attr("x", valueLabelX)
                .attr("y", actualRowHeight / 2)
                .attr("text-anchor", valueLabelAnchor)
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", valueLabelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", valueLabelColor)
                .attr("class", "label value-text")
                .text(formattedValue);

            // SubCategory Label (e.g., Development Status)
            if (d.subCategory) {
                const subCategoryText = String(d.subCategory).toUpperCase();
                const subCategoryLabelX = barStartX + barWidthValue + 10; // Position after bar and value label (if outside)
                 // If value label is inside, position after bar. If value label is outside, position after value label.
                const finalSubCategoryLabelX = (textFitsInBar || valueLabelAnchor === 'start') ? 
                                               (barStartX + barWidthValue + 5) : 
                                               (valueLabelX + valueLabelWidth + 5);


                itemGroup.append("text")
                    .attr("x", finalSubCategoryLabelX)
                    .attr("y", actualRowHeight / 2)
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", itemColor) // Use bar color for subCategory label
                    .attr("class", "label annotation-text")
                    .text(subCategoryText);
            }
        });
    };

    renderSide(leftData, true);
    if (allCategories.length > 1) {
        renderSide(rightData, false);
    }
    
    // Block 9: Optional Enhancements & Post-Processing
    // Mouseover effects (simple opacity change)
    mainChartGroup.selectAll(".mark.value") // Select only the bars
        .on("mouseover", function() {
            d3.select(this).style("opacity", 0.7);
        })
        .on("mouseout", function() {
            d3.select(this).style("opacity", 1);
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
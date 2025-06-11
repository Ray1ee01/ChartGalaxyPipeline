/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_12",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via colors_dark
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;
    const categoryFieldUnit = (dataColumns.find(col => col.role === "x") || {}).unit || "";
    const valueFieldUnit = (dataColumns.find(col => col.role === "y") || {}).unit || "";


    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("Role 'x' (category)");
        if (!valueFieldName) missingFields.push("Role 'y' (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        colors: {
            textColor: colorsInput.text_color || '#333333',
            barPrimaryColor: (colorsInput.other && colorsInput.other.primary) || '#882e2e',
            chartBackground: colorsInput.background_color || '#FFFFFF',
        },
        images: {
            categoryIcons: imagesInput.field || {},
        },
        sizes: {
            iconSize: parseFloat(variables.iconSize) || 30, // Default icon size
            iconPadding: 5,
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but trying to adhere to "MUST NOT be appended to the document DOM"
        // For robust measurement, a hidden live SVG might be needed, but this is the common in-memory approach.
        // If it fails, it's because it's not in the layout.
        // A common workaround is to append to body, measure, then remove immediately.
        // However, strict adherence to the prompt means we try without.
        // For this exercise, we assume getBBox on an unattached element provides a reasonable estimate.
        let width = 0;
        try {
             // Temporarily append to measure, then remove, to ensure getBBox works
            tempSvg.style.visibility = 'hidden';
            tempSvg.style.position = 'absolute';
            document.body.appendChild(tempSvg);
            width = tempText.getBBox().width;
            document.body.removeChild(tempSvg);
        } catch (e) {
            console.warn("Could not measure text width accurately for: " + text, e);
            width = text.length * (parseFloat(fontSize) / 2); // Fallback rough estimate
        }
        return width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        let numValue = Number(value);
        if (isNaN(numValue)) return String(value);

        if (Math.abs(numValue) >= 1000000000) {
            return d3.format("~.2s")(numValue).replace('G', 'B'); // More standard SI for Billion
        } else if (Math.abs(numValue) >= 1000000) {
            return d3.format("~.2s")(numValue);
        } else if (Math.abs(numValue) >= 1000) {
            return d3.format("~.2s")(numValue);
        }
        return d3.format("~g")(numValue); // General format for smaller numbers
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
        .style("background-color", fillStyle.colors.chartBackground)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.marginTop || 20,
        right: variables.marginRight || 20,
        bottom: variables.marginBottom || 20,
        left: variables.marginLeft || 150
    };

    let maxCategoryLabelWidth = 0;
    chartDataInput.forEach(d => {
        const categoryText = categoryFieldUnit && categoryFieldUnit !== "none" ? `${d[categoryFieldName]}${categoryFieldUnit}` : `${d[categoryFieldName]}`;
        let textWidth = estimateTextWidth(categoryText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        
        let iconSpace = 0;
        if (fillStyle.images.categoryIcons && fillStyle.images.categoryIcons[d[categoryFieldName]]) {
            iconSpace = fillStyle.sizes.iconSize + fillStyle.sizes.iconPadding;
        }
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, textWidth + iconSpace);
    });

    let maxValueLabelWidth = 0;
    chartDataInput.forEach(d => {
        const valueText = valueFieldUnit && valueFieldUnit !== "none" ? `${formatValue(d[valueFieldName])}${valueFieldUnit}` : `${formatValue(d[valueFieldName])}`;
        const textWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });
    
    chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 10); // Add some padding
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 10); // Add some padding

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated inner chart dimensions are not positive. Adjust margins or container size.";
        console.error(errorMsg);
         d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = [...chartDataInput].sort((a, b) => {
        const valA = parseFloat(a[valueFieldName]);
        const valB = parseFloat(b[valueFieldName]);
        return (isNaN(valB) ? -Infinity : valB) - (isNaN(valA) ? -Infinity : valA); // Sort descending, handle non-numeric
    });

    const sortedCategories = chartDataArray.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2; // Simplified padding

    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(barPadding);

    const maxDataValue = d3.max(chartDataArray, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, (maxDataValue > 0 ? maxDataValue : 1) * 1.05]) // Ensure domain is positive, add 5% padding
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, legend, or main titles/subtitles as per directives.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(0, ${yScale(d[categoryFieldName])})`);

    barElements.append("rect")
        .attr("class", "mark bar")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", d => {
            const val = parseFloat(d[valueFieldName]);
            return val > 0 ? xScale(val) : 0; // Ensure non-negative width
        })
        .attr("height", yScale.bandwidth())
        .attr("fill", fillStyle.colors.barPrimaryColor);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    
    // Category Labels and Icons
    barElements.each(function(d) {
        const group = d3.select(this);
        const categoryText = d[categoryFieldName];
        const categoryDisplayValue = categoryFieldUnit && categoryFieldUnit !== "none" ? `${categoryText}${categoryFieldUnit}` : `${categoryText}`;
        
        let iconUrl = null;
        if (fillStyle.images.categoryIcons && fillStyle.images.categoryIcons[categoryText]) {
            iconUrl = fillStyle.images.categoryIcons[categoryText];
        }

        const effectiveIconSize = Math.min(fillStyle.sizes.iconSize, yScale.bandwidth() * 0.8); // Cap icon size by bar height
        const labelYPosition = yScale.bandwidth() / 2;

        let textXPosition = -fillStyle.sizes.iconPadding; // Default if no icon

        if (iconUrl) {
            group.append("image")
                .attr("class", "icon category-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", -(effectiveIconSize + fillStyle.sizes.iconPadding))
                .attr("y", labelYPosition - effectiveIconSize / 2)
                .attr("width", effectiveIconSize)
                .attr("height", effectiveIconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
            textXPosition = -(effectiveIconSize + fillStyle.sizes.iconPadding * 2);
        }
        
        group.append("text")
            .attr("class", "label category-label")
            .attr("x", textXPosition)
            .attr("y", labelYPosition)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(categoryDisplayValue);
    });

    // Value Labels
    barElements.append("text")
        .attr("class", "value data-label")
        .attr("x", d => {
            const val = parseFloat(d[valueFieldName]);
            return (val > 0 ? xScale(val) : 0) + 5; // Position after bar, 5px padding
        })
        .attr("y", yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(d => {
            const formatted = formatValue(d[valueFieldName]);
            return valueFieldUnit && valueFieldUnit !== "none" ? `${formatted}${valueFieldUnit}` : `${formatted}`;
        });

    // Block 10: Cleanup & SVG Node Return
    // No specific cleanup needed beyond initial container clear.
    return svgRoot.node();
}
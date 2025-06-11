/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_plain_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
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
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || data.colors_dark || {}; 
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x"; // Typically category
    const yFieldRole = "y"; // Typically value

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);

    const categoryFieldName = xFieldDef ? xFieldDef.name : undefined;
    const valueFieldName = yFieldDef ? yFieldDef.name : undefined;
    
    if (!categoryFieldName || !valueFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!valueFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px; font-family: Arial, sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const valueFieldUnit = yFieldDef && yFieldDef.unit !== "none" ? yFieldDef.unit : "";

    const chartDataArray = chartDataInput.filter(d => 
        d[categoryFieldName] != null && 
        d[valueFieldName] != null && 
        !isNaN(parseFloat(d[valueFieldName]))
    ).map(d => ({
        ...d, // Copy other properties
        [categoryFieldName]: String(d[categoryFieldName]), // Ensure category is string
        [valueFieldName]: parseFloat(d[valueFieldName]) // Ensure value is numeric
    }));

    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data available to render the chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; padding:10px; font-family: Arial, sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            categoryLabel: {
                font_family: (inputTypography.label && inputTypography.label.font_family) || "Arial, sans-serif",
                font_size: (inputTypography.label && inputTypography.label.font_size) || "12px",
                font_weight: (inputTypography.label && inputTypography.label.font_weight) || "normal",
            },
            valueLabel: { // Using 'annotation' from spec for value labels
                font_family: (inputTypography.annotation && inputTypography.annotation.font_family) || "Arial, sans-serif",
                font_size: (inputTypography.annotation && inputTypography.annotation.font_size) || "10px", // Base size, will be scaled
                font_weight: (inputTypography.annotation && inputTypography.annotation.font_weight) || "normal",
            }
        },
        textColor: inputColors.text_color || "#333333",
        chartBackground: inputColors.background_color || "#FFFFFF",
        barExtensionBackground: (inputColors.other && inputColors.other.extension_background) || "#e6f0fa",
        primaryColor: (inputColors.other && inputColors.other.primary) || "#1E88E5",
        getBarColor: (category, categoryIndex) => {
            if (inputColors.field && inputColors.field[category]) {
                return inputColors.field[category];
            }
            if (inputColors.available_colors && inputColors.available_colors.length > 0) {
                return inputColors.available_colors[categoryIndex % inputColors.available_colors.length];
            }
            return fillStyle.primaryColor;
        }
    };
    
    function _estimateTextWidthInternal(text, fontFamily, fontSize, fontWeight) {
        const tempSvgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const tempTextNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tempTextNode.setAttribute("font-family", fontFamily);
        tempTextNode.setAttribute("font-size", fontSize);
        tempTextNode.setAttribute("font-weight", fontWeight);
        tempTextNode.textContent = text;
        tempSvgNode.appendChild(tempTextNode);
        let width = 0;
        try {
            width = tempTextNode.getBBox().width;
            if (width === 0 && text && String(text).length > 0) {
                width = String(text).length * (parseFloat(fontSize) || 10) * 0.6;
            }
        } catch (e) {
            console.warn("Could not estimate text width in-memory, falling back to rough estimate:", e);
            width = String(text).length * (parseFloat(fontSize) || 10) * 0.6;
        }
        return width;
    }

    function _wrapText(text, maxWidth, fontFamily, fontSize, fontWeight) {
        const FONT_SIZE_PX = parseFloat(fontSize) || 12;
        const initialWidth = _estimateTextWidthInternal(text, fontFamily, `${FONT_SIZE_PX}px`, fontWeight);

        if (initialWidth <= maxWidth) {
            return [text];
        }

        const words = String(text).split(/\s+/);
        const lines = [];
        let currentLine = words[0] || "";

        if (words.length > 1) {
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const testLine = currentLine + " " + word;
                if (_estimateTextWidthInternal(testLine, fontFamily, `${FONT_SIZE_PX}px`, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
        }
        lines.push(currentLine);

        const finalLines = [];
        lines.forEach(line => {
            if (_estimateTextWidthInternal(line, fontFamily, `${FONT_SIZE_PX}px`, fontWeight) > maxWidth) {
                let currentSubLine = "";
                for (const char of String(line).split('')) {
                    if (_estimateTextWidthInternal(currentSubLine + char, fontFamily, `${FONT_SIZE_PX}px`, fontWeight) <= maxWidth) {
                        currentSubLine += char;
                    } else {
                        finalLines.push(currentSubLine);
                        currentSubLine = char;
                    }
                }
                finalLines.push(currentSubLine);
            } else {
                finalLines.push(line);
            }
        });
        return finalLines.filter(line => String(line).trim() !== "");
    }

    const _formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // Giga to Billion
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value); // Mega
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value); // Kilo
        return d3.format("~g")(value); // General format for smaller numbers
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    let containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    
    if (uniqueCategories.length > 15 && (variables.height || 600) > 0) { // Check base height > 0
        const baseHeight = variables.height || 600;
        containerHeight = baseHeight * (1 + (uniqueCategories.length - 15) * 0.03);
        svgRoot.attr("height", containerHeight);
    }
    
    let maxCategoryLabelWidth = 0;
    uniqueCategories.forEach(cat => {
        const labelWidth = _estimateTextWidthInternal(
            cat,
            fillStyle.typography.categoryLabel.font_family,
            fillStyle.typography.categoryLabel.font_size,
            fillStyle.typography.categoryLabel.font_weight
        );
        if (labelWidth > maxCategoryLabelWidth) maxCategoryLabelWidth = labelWidth;
    });
    maxCategoryLabelWidth = Math.min(maxCategoryLabelWidth, containerWidth * 0.3); // Cap at 30% of container width

    const chartMargins = {
        top: variables.margin_top || 20,
        right: variables.margin_right || Math.max(20, containerWidth * 0.1), // Ensure some space for overflowing value labels
        bottom: variables.margin_bottom || 30,
        left: variables.margin_left || Math.max(20, maxCategoryLabelWidth + 15) // Space for category labels + padding
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Not enough space to render chart after applying margins.";
        console.error(errorMsg + ` InnerWidth: ${innerWidth}, InnerHeight: ${innerHeight}`);
        svgRoot.append("text").attr("class", "text error-text")
            .attr("x", containerWidth / 2).attr("y", containerHeight / 2)
            .attr("text-anchor", "middle").style("fill", "red")
            .text(errorMsg);
        return svgRoot.node();
    }

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2;

    const yScale = d3.scaleBand()
        .domain(sortedData.map(d => d[categoryFieldName]))
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, 100]) // Values are expected to be percentages (0-100)
        .range([0, innerWidth]);

    const barHeight = yScale.bandwidth();
    if (barHeight <= 0) {
         const errorMsg = "Calculated bar height is not positive. Cannot render bars.";
         console.error(errorMsg);
         svgRoot.append("text").attr("class", "text error-text")
            .attr("x", containerWidth / 2).attr("y", containerHeight / 2)
            .attr("text-anchor", "middle").style("fill", "red")
            .text(errorMsg);
         return svgRoot.node();
    }

    // Block 7: Chart Component Rendering (Not applicable for axes/gridlines in this chart)

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // 'other' for main group

    sortedData.forEach((d, index) => {
        const category = d[categoryFieldName];
        const value = d[valueFieldName];

        const barGroup = mainChartGroup.append("g")
            .attr("class", "bar-item-group other") // 'other' for item group
            .attr("transform", `translate(0, ${yScale(category)})`);

        barGroup.append("rect")
            .attr("class", "mark extension-bar")
            .attr("x", 0).attr("y", 0)
            .attr("width", innerWidth)
            .attr("height", barHeight)
            .attr("fill", fillStyle.barExtensionBackground);

        const actualBarWidth = xScale(Math.max(0, Math.min(value, 100)));
        barGroup.append("rect")
            .attr("class", "mark value-bar")
            .attr("x", 0).attr("y", 0)
            .attr("width", actualBarWidth)
            .attr("height", barHeight)
            .attr("fill", fillStyle.getBarColor(category, index));

        const valueLabelStyle = fillStyle.typography.valueLabel;
        const dynamicValueFontSize = Math.max(8, barHeight * 0.4); // Ensure min font size (e.g. 8px)
        const valueLabelText = valueFieldUnit ? `${_formatValue(value)}${valueFieldUnit}` : _formatValue(value);
        
        const valueLabelWidth = _estimateTextWidthInternal(
            valueLabelText, 
            valueLabelStyle.font_family, 
            `${dynamicValueFontSize}px`,
            valueLabelStyle.font_weight
        );

        const isValueLabelInside = valueLabelWidth + 10 < actualBarWidth;

        barGroup.append("text")
            .attr("class", "label value-label value") // Added 'value' class
            .attr("x", isValueLabelInside ? actualBarWidth - 5 : actualBarWidth + 5)
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", isValueLabelInside ? "end" : "start")
            .style("font-family", valueLabelStyle.font_family)
            .style("font-size", `${dynamicValueFontSize}px`)
            .style("font-weight", valueLabelStyle.font_weight)
            .style("fill", isValueLabelInside ? "#FFFFFF" : fillStyle.textColor)
            .text(valueLabelText);
            
        const categoryLabelStyle = fillStyle.typography.categoryLabel;
        const wrappedCategoryLines = _wrapText(
            category,
            maxCategoryLabelWidth,
            categoryLabelStyle.font_family,
            categoryLabelStyle.font_size,
            categoryLabelStyle.font_weight
        );

        const categoryLineHeight = (parseFloat(categoryLabelStyle.font_size) || 12) * 1.2;
        const totalCategoryLabelHeight = wrappedCategoryLines.length * categoryLineHeight;
        
        const categoryLabelGroup = barGroup.append("g")
            .attr("class", "category-label-group other"); // 'other' for label group

        wrappedCategoryLines.forEach((line, i) => {
            categoryLabelGroup.append("text")
                .attr("class", "label category-label-line text") // Added 'text' class
                .attr("x", -10) // Positioned to the left of the bar start (0)
                .attr("y", (barHeight / 2) + (i * categoryLineHeight) - (totalCategoryLabelHeight / 2) + (categoryLineHeight / 2))
                .attr("dominant-baseline", "middle")
                .attr("text-anchor", "end")
                .style("font-family", categoryLabelStyle.font_family)
                .style("font-size", categoryLabelStyle.font_size)
                .style("font-weight", categoryLabelStyle.font_weight)
                .style("fill", fillStyle.textColor)
                .text(line);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing (None specific)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Horizontal Bar Chart",
  "chart_name": "horizontal_group_bar_chart_05",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["x"],
  "required_other_icons": ["primary"],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if needed
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    const chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    const missingFields = [];
    if (!dimensionFieldDef) missingFields.push("x role field definition");
    if (!valueFieldDef) missingFields.push("y role field definition");
    if (!groupFieldDef) missingFields.push("group role field definition");
    
    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionFieldName = dimensionFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;

    if (!dimensionFieldName) missingFields.push("x role field name");
    if (!valueFieldName) missingFields.push("y role field name");
    if (!groupFieldName) missingFields.push("group role field name");

    if (missingFields.length > 0) { // Check again if names are missing from valid defs
        const errorMsg = `Critical chart config missing field names for: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    const dimensionUnit = dimensionFieldDef.unit && dimensionFieldDef.unit !== "none" ? dimensionFieldDef.unit : "";
    const valueUnit = valueFieldDef.unit && valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";

    if (!chartDataArray || chartDataArray.length === 0) {
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='padding:10px;'>No data to display.</div>");
        }
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        defaultCategoryColor: '#CCCCCC',
        primaryAccentColor: (colorsConfig.other && colorsConfig.other.primary) || '#007bff',
        typography: {
            // title styles are defined but not used as per requirements
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) || '18px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        }
    };

    fillStyle.getCategoryColor = (groupName, index) => {
        if (colorsConfig.field && colorsConfig.field[groupName]) {
            return colorsConfig.field[groupName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        // Fallback to d3.schemeCategory10 if available_colors is not sufficient or not provided
        if (d3.schemeCategory10 && d3.schemeCategory10.length > 0) {
             return d3.schemeCategory10[index % d3.schemeCategory10.length];
        }
        return fillStyle.defaultCategoryColor;
    };

    fillStyle.getImageUrl = (key) => {
        if (imagesConfig.field && imagesConfig.field[key]) {
            return imagesConfig.field[key];
        }
        // Fallback to a generic primary icon if specified in images.other.primary
        if (imagesConfig.other && imagesConfig.other.primary) {
            return imagesConfig.other.primary;
        }
        return null;
    };
    
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        if (!text) return 0;
        const tempSvgForTextMeasurement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Position off-screen just in case, though not appending to DOM
        tempSvgForTextMeasurement.style.position = 'absolute';
        tempSvgForTextMeasurement.style.visibility = 'hidden';
        tempSvgForTextMeasurement.style.left = '-9999px';


        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontFamily);
        tempTextElement.setAttribute('font-size', fontSize);
        tempTextElement.setAttribute('font-weight', fontWeight);
        tempTextElement.textContent = text;
        tempSvgForTextMeasurement.appendChild(tempTextElement);
        
        // Some browsers require the SVG to be in the DOM to compute BBox correctly.
        // However, per strict instructions, not appending to DOM.
        // This relies on getBBox working on in-memory elements.
        let width = 0;
        try {
            width = tempTextElement.getBBox().width;
        } catch (e) {
            console.warn("Could not measure text width using in-memory SVG.", e);
            // Fallback: crude estimation (e.g., average char width * length)
            width = text.length * (parseFloat(fontSize) * 0.6); 
        }
        return width;
    };

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        const num = Number(value);
        if (isNaN(num)) return String(value); // Return original if not a number

        if (Math.abs(num) < 1000) {
            return d3.format("~g")(num); // General format for smaller numbers
        } else {
            // Use SI notation for larger numbers, customize G to B
            let formatted = d3.format("~.2s")(num); // ~.2s gives 2 significant digits
            if (formatted.endsWith("G")) { 
                formatted = formatted.slice(0, -1) + "B"; // Giga to Billion
            }
            return formatted;
        }
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const dimensionsArray = [...new Set(chartDataArray.map(d => d[dimensionFieldName]))];
    const groupsArray = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    const initialChartMargins = { top: 60, right: 30, bottom: 40, left: 60 }; 

    const estimatedIconWidthForMargins = 25; 
    const iconPaddingForMargins = 5; 
    const textPaddingToIconForMargins = 5;
    let maxCalculatedDimLabelWidth = 0;
    dimensionsArray.forEach(dim => {
        const labelText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const textW = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        // Total width for this label: icon + padding + text
        maxCalculatedDimLabelWidth = Math.max(maxCalculatedDimLabelWidth, estimatedIconWidthForMargins + iconPaddingForMargins + textW + textPaddingToIconForMargins);
    });
    
    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const labelText = valueUnit ? `${formatValue(d[valueFieldName])}${valueUnit}` : `${formatValue(d[valueFieldName])}`;
        const textW = estimateTextWidth(labelText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textW);
    });

    const legendItemOuterPadding = 10;
    let totalLegendWidth = 0;
    const legendItemWidths = groupsArray.map(group => {
        const textW = estimateTextWidth(group, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const itemW = 15 + 5 + textW + legendItemOuterPadding; // rect width + padding + text width + outer padding
        totalLegendWidth += itemW;
        return itemW;
    });
    if (groupsArray.length > 0 && totalLegendWidth > 0) {
      totalLegendWidth -= legendItemOuterPadding; // Remove last item's outer padding
    }


    const chartMargins = { ...initialChartMargins };
    chartMargins.left = Math.max(initialChartMargins.left, maxCalculatedDimLabelWidth + 10); // Add buffer from SVG edge
    chartMargins.right = Math.max(initialChartMargins.right, maxValueLabelWidth + 10); // Add buffer for value labels

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated inner chart dimensions are not positive. Aborting rendering. Adjust size or margins.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    // Data is in chartDataArray. dimensionsArray and groupsArray are prepared.

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensionsArray)
        .range([0, innerHeight])
        .padding(0.25); // Fixed padding for groups of bars

    const maxValueFromData = d3.max(chartDataArray, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, maxValueFromData > 0 ? maxValueFromData : 1]) 
        .range([0, innerWidth]);

    const colorScale = d3.scaleOrdinal()
        .domain(groupsArray)
        .range(groupsArray.map((group, i) => fillStyle.getCategoryColor(group, i)));

    // Block 7: Chart Component Rendering (Legend)
    if (groupsArray.length > 0 && totalLegendWidth > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2.5})`); // Position legend

        let currentLegendXOffset = 0;
        groupsArray.forEach((group, i) => {
            const legendItemG = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentLegendXOffset}, 0)`);

            legendItemG.append("rect")
                .attr("class", "mark legend-color-sample")
                .attr("width", 15)
                .attr("height", 15)
                .attr("fill", colorScale(group));

            legendItemG.append("text")
                .attr("class", "label legend-label")
                .attr("x", 20) // Space after rect
                .attr("y", 7.5) 
                .attr("dy", "0.35em") 
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(group);
            
            currentLegendXOffset += legendItemWidths[i];
        });
    }
    
    // Block 8: Main Data Visualization Rendering
    const dimensionElementGroups = mainChartGroup.selectAll(".dimension-group")
        .data(dimensionsArray)
        .enter()
        .append("g")
        .attr("class", d => `dimension-group dimension-${String(d).replace(/\s+/g, '-').toLowerCase()}`)
        .attr("transform", d => `translate(0, ${yScale(d)})`);

    dimensionElementGroups.each(function(currentDimension) {
        const singleDimensionGroup = d3.select(this);
        const dataForCurrentDimension = chartDataArray.filter(d => d[dimensionFieldName] === currentDimension);
        
        const bandTotalHeight = yScale.bandwidth();
        const individualGroupBarHeight = bandTotalHeight / groupsArray.length;

        // Bars and Value Labels for each group within the dimension
        groupsArray.forEach((currentGroup, groupIdx) => {
            const dataPoint = dataForCurrentDimension.find(d => d[groupFieldName] === currentGroup);
            if (dataPoint) {
                const value = parseFloat(dataPoint[valueFieldName]);
                if (isNaN(value) || value === null) return; 

                const barCalculatedWidth = xScale(Math.max(0, value)); 
                const barYPosition = groupIdx * individualGroupBarHeight;

                singleDimensionGroup.append("rect")
                    .attr("class", "mark bar")
                    .attr("x", 0)
                    .attr("y", barYPosition)
                    .attr("width", barCalculatedWidth)
                    .attr("height", individualGroupBarHeight)
                    .attr("fill", colorScale(currentGroup))
                    .on("mouseover", function() { d3.select(this).style("opacity", 0.7); })
                    .on("mouseout", function() { d3.select(this).style("opacity", 1); });

                const valueLabelText = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
                singleDimensionGroup.append("text")
                    .attr("class", "label value-label")
                    .attr("x", barCalculatedWidth + 5) // 5px padding after bar
                    .attr("y", barYPosition + individualGroupBarHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(valueLabelText);
            }
        });

        // Block 9: Optional Enhancements & Post-Processing (Icons and Text for dimension labels)
        const iconImageUrl = fillStyle.getImageUrl(currentDimension);
        let actualIconRenderWidth = 0;
        const iconRenderHeight = bandTotalHeight * 0.7; 
        const iconAspectRatio = 1.33; 
        const iconRightPadding = 5; // Padding between icon and y-axis (bar start)
        const textIconSpacing = 5; // Padding between text and icon
        
        if (iconImageUrl) {
            actualIconRenderWidth = iconRenderHeight * iconAspectRatio;
            singleDimensionGroup.append("image")
                .attr("class", "icon dimension-icon")
                .attr("xlink:href", iconImageUrl)
                .attr("x", -(actualIconRenderWidth + iconRightPadding)) 
                .attr("y", (bandTotalHeight - iconRenderHeight) / 2) 
                .attr("width", actualIconRenderWidth)
                .attr("height", iconRenderHeight)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

        const dimensionLabelText = dimensionUnit ? `${currentDimension}${dimensionUnit}` : `${currentDimension}`;
        singleDimensionGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", -( (iconImageUrl ? actualIconRenderWidth + iconRightPadding : 0) + textIconSpacing) ) 
            .attr("y", bandTotalHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dimensionLabelText);
    });
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
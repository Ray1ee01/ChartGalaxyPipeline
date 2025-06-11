/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Pictogram Bar Chart",
  "chart_name": "grouped_pictogram_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 6], [0, 100], [3, 4]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || (data.colors_dark || {});
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];
    let chartDataArray = data.data?.data || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;

    const yAxisUnit = dataColumns.find(col => col.role === "y" && col.unit !== "none")?.unit || "";

    const criticalFields = { categoryFieldName, valueFieldName, groupFieldName };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMsg = `Error: Critical chart configuration missing data column roles for: ${missingFields.map(f => f.replace("FieldName","")).join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("padding", "10px")
                .html(errorMsg);
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
            backgroundColor: colorsInput.background_color || '#FFFFFF', // Default to white
            primaryColor: (colorsInput.other && colorsInput.other.primary) || '#4682B4', // Default primary
            getGroupColor: (groupVal, index) => {
                if (colorsInput.field && colorsInput.field[groupVal]) {
                    return colorsInput.field[groupVal];
                }
                if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                    return colorsInput.available_colors[index % colorsInput.available_colors.length];
                }
                return d3.schemeCategory10[index % 10];
            }
        },
        images: {
            getIconUrl: (groupVal) => (imagesInput.field && imagesInput.field[groupVal]) || null
        }
    };

    function estimateTextWidth(text, fontProps) {
        if (!text || typeof text !== 'string') return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        tempText.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        tempText.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No DOM append needed for getBBox if styles are applied directly
        const width = tempText.getBBox().width;
        tempSvg.removeChild(tempText); // Clean up
        return width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "N/A";
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.colors.backgroundColor)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 60 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const allCategories = Array.from(new Set(chartDataArray.map(d => d[categoryFieldName])));
    const allGroups = Array.from(new Set(chartDataArray.map(d => d[groupFieldName])));

    const processedData = chartDataArray.reduce((acc, d) => {
        const category = d[categoryFieldName];
        const group = d[groupFieldName];
        const value = +d[valueFieldName];

        let categoryEntry = acc.find(item => item.category === category);
        if (!categoryEntry) {
            categoryEntry = { category: category, groupsData: {} };
            acc.push(categoryEntry);
        }
        categoryEntry.groupsData[group] = value;
        return acc;
    }, []);
    
    const yDomainMax = d3.max(chartDataArray, d => +d[valueFieldName]) || 1; // Ensure max is at least 1

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(allCategories)
        .range([0, innerWidth])
        .padding(0.2);

    const groupScale = d3.scaleBand()
        .domain(allGroups)
        .range([0, xScale.bandwidth()])
        .padding(0.05);

    // Y-scale is implicitly used for max value in icon calculation, not for direct positioning of a continuous axis.
    // const yScale = d3.scaleLinear().domain([0, yDomainMax]).range([innerHeight, 0]).nice(); // Not directly used for axis

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    let rotateXLabels = false;
    const maxXLabelWidth = xScale.bandwidth(); // Max width for a label without rotation
    allCategories.forEach(cat => {
        if (estimateTextWidth(String(cat), { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        }) > maxXLabelWidth) {
            rotateXLabels = true;
        }
    });

    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis)
        .selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .style("text-anchor", rotateXLabels ? "end" : "middle")
        .attr("dx", rotateXLabels ? "-0.8em" : null)
        .attr("dy", rotateXLabels ? "0.15em" : "0.71em") // Adjust dy for rotated and non-rotated
        .attr("transform", rotateXLabels ? "rotate(-45)" : "rotate(0)");

    // Y-axis is not rendered as per original behavior (domain and text removed)

    // Block 8: Main Data Visualization Rendering
    const categoryGroups = mainChartGroup.selectAll(".category-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", d => `category-group mark category-${String(d.category).replace(/\s+/g, '-')}`)
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    const iconSize = Math.max(5, groupScale.bandwidth() * 0.8); // Ensure iconSize is not too small
    const iconSpacing = iconSize * 0.1;
    const maxIconsPerColumn = Math.max(1, Math.floor(innerHeight / (iconSize + iconSpacing)));

    allGroups.forEach((groupName, groupIndex) => {
        const iconUrl = fillStyle.images.getIconUrl(groupName);

        categoryGroups.each(function(d) { // 'd' is a category object from processedData
            const categoryData = d;
            const value = categoryData.groupsData[groupName] || 0;
            // Original logic: map value to 0-10 icons based on yDomainMax
            const iconCount = (yDomainMax > 0) ? Math.ceil(value / yDomainMax * 10) : 0;
            
            const groupXOffset = groupScale(groupName);

            if (iconUrl && iconCount > 0) {
                const iconsInThisGroup = d3.select(this).append("g")
                    .attr("class", `icon-stack mark group-${String(groupName).replace(/\s+/g, '-')}`);

                for (let i = 0; i < iconCount; i++) {
                    const columnIndex = Math.floor(i / maxIconsPerColumn);
                    const rowIndex = i % maxIconsPerColumn;

                    iconsInThisGroup.append("image")
                        .attr("class", "icon mark")
                        .attr("xlink:href", iconUrl)
                        .attr("x", groupXOffset + columnIndex * (iconSize + iconSpacing))
                        .attr("y", innerHeight - (rowIndex + 1) * (iconSize + iconSpacing))
                        .attr("width", iconSize)
                        .attr("height", iconSize);
                }
            }

            // Add data labels
            const columnsForIcons = (iconCount > 0) ? Math.ceil(iconCount / maxIconsPerColumn) : 1;
            const labelX = groupXOffset + (columnsForIcons * (iconSize + iconSpacing)) / 2 - (columnsForIcons > 1 ? (iconSpacing/2) : 0) ; // Center label over icons
            const rowsForIcons = Math.min(iconCount, maxIconsPerColumn);
            const labelY = innerHeight - (rowsForIcons * (iconSize + iconSpacing)) - 5; // Position above icons

            d3.select(this).append("text")
                .attr("class", "label value-label")
                .attr("x", labelX)
                .attr("y", labelY < 0 ? 10 : labelY) // Prevent label from going off-chart
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(formatValue(value) + (yAxisUnit ? ` ${yAxisUnit}` : ''));
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
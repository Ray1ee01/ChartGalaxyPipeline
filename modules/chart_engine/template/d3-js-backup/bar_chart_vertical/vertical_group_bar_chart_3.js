/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Vertical Bar Chart",
  "chart_name": "vertical_group_bar_chart_3",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 6], [0, "inf"], [2, 8]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external to this function)

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data.data;
    const variables = data.variables || {};
    const dataTypography = data.typography || {};
    const dataColors = data.colors || {};
    const dataImages = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getFieldNameByRole = (role) => {
        const column = dataColumns.find(col => col.role === role);
        return column ? column.name : undefined;
    };

    const categoryFieldName = getFieldNameByRole(xFieldRole);
    const valueFieldName = getFieldNameByRole(yFieldRole);
    const groupFieldName = getFieldNameByRole(groupFieldRole);

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        const missingFields = [
            !categoryFieldName ? `field with role '${xFieldRole}'` : null,
            !valueFieldName ? `field with role '${yFieldRole}'` : null,
            !groupFieldName ? `field with role '${groupFieldRole}'` : null
        ].filter(Boolean).join(', ');

        const errorMessage = `Critical chart config missing: ${missingFields}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const xValues = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    const groupValues = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    let yUnit = "";
    const yColumn = dataColumns.find(col => col.name === valueFieldName);
    if (yColumn && yColumn.unit && yColumn.unit !== "none") {
        yUnit = yColumn.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const DEFAULT_FONT_FAMILY = 'Arial, sans-serif';
    const DEFAULT_COLORS = {
        PRIMARY: '#1f77b4',
        BACKGROUND: '#FFFFFF',
        TEXT: '#0f223b',
        SERIES: d3.schemeCategory10
    };
    const IMAGE_SIZE = 32; // Standardized image size

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        }
        return d3.format("~g")(value);
    };
    
    const fillStyle = {};
    fillStyle.chartBackground = dataColors.background_color || DEFAULT_COLORS.BACKGROUND;
    fillStyle.textColor = dataColors.text_color || DEFAULT_COLORS.TEXT;
    fillStyle.axisLineColor = fillStyle.textColor;

    const defaultTypographyStyles = {
        title: { font_family: DEFAULT_FONT_FAMILY, font_size: "16px", font_weight: "bold" },
        label: { font_family: DEFAULT_FONT_FAMILY, font_size: "12px", font_weight: "normal" },
        annotation: { font_family: DEFAULT_FONT_FAMILY, font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography = {
        axisLabel: {
            font_family: (dataTypography.label && dataTypography.label.font_family) || defaultTypographyStyles.label.font_family,
            font_size: (dataTypography.label && dataTypography.label.font_size) || defaultTypographyStyles.label.font_size,
            font_weight: (dataTypography.label && dataTypography.label.font_weight) || defaultTypographyStyles.label.font_weight,
        },
        legendLabel: {
            font_family: (dataTypography.label && dataTypography.label.font_family) || defaultTypographyStyles.label.font_family,
            font_size: (dataTypography.label && dataTypography.label.font_size) || defaultTypographyStyles.label.font_size,
            font_weight: (dataTypography.label && dataTypography.label.font_weight) || defaultTypographyStyles.label.font_weight,
        },
        dataValueLabel: {
            font_family: (dataTypography.annotation && dataTypography.annotation.font_family) || defaultTypographyStyles.annotation.font_family,
            font_size: (dataTypography.annotation && dataTypography.annotation.font_size) || defaultTypographyStyles.annotation.font_size,
            font_weight: (dataTypography.annotation && dataTypography.annotation.font_weight) || defaultTypographyStyles.annotation.font_weight,
        }
    };
    
    fillStyle.dataValueLabelColor = (dataColors.other && dataColors.other.text_on_primary) || '#FFFFFF';

    fillStyle.getBarColor = (groupName) => {
        const groupIdx = groupValues.indexOf(groupName);
        if (dataColors.field && dataColors.field[groupName]) {
            return dataColors.field[groupName];
        }
        if (dataColors.available_colors && dataColors.available_colors.length > 0) {
            if (groupIdx !== -1) {
                return dataColors.available_colors[groupIdx % dataColors.available_colors.length];
            }
        }
        if (dataColors.other && dataColors.other.primary) {
            return dataColors.other.primary;
        }
        if (groupIdx !== -1) {
            return DEFAULT_COLORS.SERIES[groupIdx % DEFAULT_COLORS.SERIES.length];
        }
        return DEFAULT_COLORS.PRIMARY;
    };
    fillStyle.getLegendMarkerColor = fillStyle.getBarColor;

    fillStyle.getXAxisIconUrl = (xValue) => {
        if (dataImages.field && dataImages.field[xValue]) {
            return dataImages.field[xValue];
        }
        return null;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: 60, right: 100, bottom: 60, left: 80 };

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    // (xValues, groupValues, yUnit already extracted in Block 1)

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2);

    const xGroupScale = d3.scaleBand()
        .domain(groupValues)
        .range([0, xScale.bandwidth()])
        .padding(0.1); // Standardized padding

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => d[valueFieldName]) * 1.1 || 10]) // Added || 10 for empty data case
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale));

    xAxisGroup.selectAll("text")
        .attr("class", "label x-axis-label")
        .attr("transform", `translate(0, ${IMAGE_SIZE + 2})`) // Position text below icons
        .style("text-anchor", "middle")
        .style("font-family", fillStyle.typography.axisLabel.font_family)
        .style("font-size", fillStyle.typography.axisLabel.font_size)
        .style("font-weight", fillStyle.typography.axisLabel.font_weight)
        .style("fill", fillStyle.textColor);
    
    xAxisGroup.selectAll("line, path")
        .style("stroke", fillStyle.axisLineColor);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickFormat(d => formatValue(d) + (yUnit ? ` ${yUnit}` : '')));

    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .style("font-family", fillStyle.typography.axisLabel.font_family)
        .style("font-size", fillStyle.typography.axisLabel.font_size)
        .style("font-weight", fillStyle.typography.axisLabel.font_weight)
        .style("fill", fillStyle.textColor);

    yAxisGroup.selectAll("line, path")
        .style("stroke", fillStyle.axisLineColor);

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend other")
        .attr("transform", `translate(${containerWidth - chartMargins.right + 20}, ${chartMargins.top})`);

    groupValues.forEach((group, i) => {
        const legendRow = legendGroup.append("g")
            .attr("class", "legend-item group")
            .attr("transform", `translate(0, ${i * 25})`);

        legendRow.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", fillStyle.getLegendMarkerColor(group));

        legendRow.append("text")
            .attr("class", "label legend-label")
            .attr("x", 20)
            .attr("y", 12) // Vertically center text with rect
            .text(group)
            .style("font-family", fillStyle.typography.legendLabel.font_family)
            .style("font-size", fillStyle.typography.legendLabel.font_size)
            .style("font-weight", fillStyle.typography.legendLabel.font_weight)
            .style("fill", fillStyle.textColor);
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barRootGroups = mainChartGroup.selectAll(".bar-root-group")
        .data(xValues)
        .enter()
        .append("g")
        .attr("class", (d) => `group mark-group x-category-${String(d).replace(/\s+/g, '-')}`)
        .attr("transform", d => `translate(${xScale(d)},0)`);

    const barElements = barRootGroups.selectAll(".bar")
        .data(d_xVal => { // d_xVal is an xValue (category)
            return groupValues.map(groupVal => {
                const match = chartDataArray.find(item => item[categoryFieldName] === d_xVal && item[groupFieldName] === groupVal);
                return {
                    xCategory: d_xVal,
                    group: groupVal,
                    value: match ? match[valueFieldName] : 0
                };
            });
        })
        .enter()
        .append("rect")
        .attr("class", "mark value bar")
        .attr("x", d_bar => xGroupScale(d_bar.group))
        .attr("y", d_bar => yScale(d_bar.value))
        .attr("width", xGroupScale.bandwidth())
        .attr("height", d_bar => innerHeight - yScale(d_bar.value))
        .attr("fill", d_bar => fillStyle.getBarColor(d_bar.group))
        .on("mouseover", function(event, d_bar) {
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function(event, d_bar) {
            d3.select(this).attr("opacity", 1);
        });

    const dataLabels = barRootGroups.selectAll(".data-label")
        .data(d_xVal => {
            return groupValues.map(groupVal => {
                const match = chartDataArray.find(item => item[categoryFieldName] === d_xVal && item[groupFieldName] === groupVal);
                return {
                    xCategory: d_xVal,
                    group: groupVal,
                    value: match ? match[valueFieldName] : 0
                };
            }).filter(d_bar => d_bar.value > 0); // Only for bars with value
        })
        .enter()
        .append("text")
        .attr("class", "label value-label data-label")
        .attr("x", d_bar => xGroupScale(d_bar.group) + xGroupScale.bandwidth() / 2)
        .attr("y", d_bar => yScale(d_bar.value) + 15) // Position inside bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.dataValueLabel.font_family)
        .style("font-size", fillStyle.typography.dataValueLabel.font_size)
        .style("font-weight", fillStyle.typography.dataValueLabel.font_weight)
        .style("fill", fillStyle.dataValueLabelColor)
        .style("pointer-events", "none")
        .text(d_bar => formatValue(d_bar.value) + (yUnit && d_bar.value !== 0 ? ` ${yUnit}` : ''));


    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const xAxisIcons = mainChartGroup.selectAll(".x-axis-icon-group")
        .data(xValues)
        .enter()
        .append("g")
        .attr("class", "icon-group x-axis-icon-group")
        .attr("transform", d_xVal => `translate(${xScale(d_xVal) + xScale.bandwidth() / 2}, ${innerHeight})`);
        
    xAxisIcons.each(function(d_xVal) {
        const iconUrl = fillStyle.getXAxisIconUrl(d_xVal);
        if (iconUrl) {
            d3.select(this).append("image")
                .attr("class", "icon x-axis-icon")
                .attr("href", iconUrl)
                .attr("x", -IMAGE_SIZE / 2)
                .attr("y", 5) // Position icon slightly below axis line
                .attr("width", IMAGE_SIZE)
                .attr("height", IMAGE_SIZE)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
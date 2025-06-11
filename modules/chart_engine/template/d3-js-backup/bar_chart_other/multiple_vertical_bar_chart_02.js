/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Vertical Bar Chart",
  "chart_name": "multiple_vertical_bar_chart_02",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["none"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Prefer light theme colors if both exist
    const images = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const y2Column = dataColumns.find(col => col.role === "y2");

    const xField = xColumn?.name;
    const yField = yColumn?.name;
    const y2Field = y2Column?.name;

    if (!xField || !yField || !y2Field) {
        console.error(`Critical chart config missing: xField (${xField}), yField (${yField}), or y2Field (${y2Field}) not found in data.columns. Cannot render.`);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .html("Critical chart configuration missing. Required fields (x, y, y2) not found in data.columns. Cannot render.");
        return null;
    }

    let xUnit = xColumn?.unit && xColumn.unit !== "none" ? xColumn.unit : "";
    let yUnit = yColumn?.unit && yColumn.unit !== "none" ? yColumn.unit : "";
    let y2Unit = y2Column?.unit && y2Column.unit !== "none" ? y2Column.unit : "";
    
    if (yUnit.length > 5) yUnit = ""; // Preserve original unit length constraint
    if (y2Unit.length > 5) y2Unit = ""; // Preserve original unit length constraint


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: {
                fontFamily: typography.title?.font_family || 'Arial, sans-serif',
                fontSize: typography.title?.font_size || '16px',
                fontWeight: typography.title?.font_weight || 'bold',
            },
            label: {
                fontFamily: typography.label?.font_family || 'Arial, sans-serif',
                fontSize: typography.label?.font_size || '12px',
                fontWeight: typography.label?.font_weight || 'normal',
            }
        },
        textColor: rawColors.text_color || '#0f223b',
        chartBackground: rawColors.background_color || '#FFFFFF',
        primaryBarColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#4682B4',
        secondaryBarColor: (rawColors.other && rawColors.other.secondary) ? rawColors.other.secondary : '#FF7F50',
        gridLineColor: '#E0E0E0',
        axisDomainColor: '#B0B0B0',
        iconCircleFill: '#FFFFFF',
        iconCircleStroke: '#CCCCCC',
        imageUrls: images.field || {},
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        
        textElement.style.fontFamily = fontProps.fontFamily;
        textElement.style.fontSize = fontProps.fontSize;
        textElement.style.fontWeight = fontProps.fontWeight;
        textElement.textContent = text;
        svg.appendChild(textElement); 
        // Note: BBox calculation on non-DOM-attached elements can be inconsistent.
        // For robust measurement, it might need temporary DOM attachment, but directive forbids it.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without rendering
            const avgCharWidth = parseFloat(fontProps.fontSize) * 0.6; // Simple approximation
            width = text.toString().length * avgCharWidth;
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
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
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 100, left: 60 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const subChartWidth = innerWidth / 2 - 20; // 20px for spacing between charts

    // Block 5: Data Preprocessing & Transformation
    const leftChartData = chartData.map(d => ({
        x: d[xField],
        y: parseFloat(d[yField]) || 0
    })).sort((a, b) => b.y - a.y);

    const rightChartData = chartData.map(d => ({
        x: d[xField],
        y: parseFloat(d[y2Field]) || 0
    })).sort((a, b) => b.y - a.y);

    const topLeftItems = leftChartData.map(d => d.x);
    const topRightItems = rightChartData.map(d => d.x);

    // Block 6: Scale Definition & Configuration
    const leftXScale = d3.scaleBand()
        .domain(topLeftItems)
        .range([0, subChartWidth])
        .padding(variables.has_spacing ? 0.4 : 0.2);

    const leftYMax = d3.max(leftChartData, d => d.y);
    const leftYScale = d3.scaleLinear()
        .domain([0, (leftYMax || 0) * 1.1])
        .range([innerHeight, 0]).nice();

    const rightXScale = d3.scaleBand()
        .domain(topRightItems)
        .range([0, subChartWidth])
        .padding(variables.has_spacing ? 0.4 : 0.2);

    const rightYMax = d3.max(rightChartData, d => d.y);
    const rightYScale = d3.scaleLinear()
        .domain([0, (rightYMax || 0) * 1.1])
        .range([innerHeight, 0]).nice();

    // Function to render a single chart (left or right)
    function renderSubChart(parentElement, chartSpecificData, xScale, yScale, color, titleText, unitText, isLeftChart) {
        const chartGroup = parentElement.append("g")
            .attr("class", isLeftChart ? "chart-group left-chart" : "chart-group right-chart");

        // Sub-chart Title
        if (titleText) {
            chartGroup.append("text")
                .attr("class", "text chart-title")
                .attr("x", 0)
                .attr("y", -15) // Position above the chart area
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.title.fontFamily)
                .style("font-size", fillStyle.typography.title.fontSize)
                .style("font-weight", fillStyle.typography.title.fontWeight)
                .style("fill", fillStyle.textColor)
                .text(titleText + (unitText ? ` (${unitText})` : ''));
        }

        // Block 7: Chart Component Rendering (Axes, Gridlines)
        // Gridlines
        chartGroup.append("g")
            .attr("class", "grid")
            .selectAll("line")
            .data(yScale.ticks(5))
            .enter()
            .append("line")
            .attr("x1", 0)
            .attr("y1", d => yScale(d))
            .attr("x2", subChartWidth)
            .attr("y2", d => yScale(d))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1);

        // X-Axis (minimal, no ticks/labels here, labels rendered separately)
        chartGroup.append("g")
            .attr("class", "axis x-axis")
            .attr("transform", `translate(0, ${innerHeight})`)
            .call(d3.axisBottom(xScale).tickSize(0).tickFormat(''))
            .select(".domain").remove(); // No visible X axis line

        // Y-Axis
        chartGroup.append("g")
            .attr("class", "axis y-axis")
            .call(g => {
                const axis = d3.axisLeft(yScale)
                    .ticks(5)
                    .tickSize(0)
                    .tickFormat(d => formatValue(d) + (d !== 0 ? unitText : '')); // Add unit only if not zero
                g.call(axis);
                g.select(".domain").remove(); // No visible Y axis line
                g.selectAll("text")
                    .attr("class", "label y-axis-label")
                    .style("fill", fillStyle.textColor)
                    .style("font-family", fillStyle.typography.label.fontFamily)
                    .style("font-size", fillStyle.typography.label.fontSize)
                    .style("font-weight", fillStyle.typography.label.fontWeight);
            });

        // Block 8: Main Data Visualization Rendering (Bars)
        chartGroup.selectAll(".bar")
            .data(chartSpecificData)
            .enter()
            .append("rect")
            .attr("class", "mark bar")
            .attr("x", d => xScale(d.x))
            .attr("y", d => yScale(d.y))
            .attr("width", xScale.bandwidth())
            .attr("height", d => innerHeight - yScale(d.y))
            .attr("fill", color)
            .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
            .on("mouseout", function() { d3.select(this).attr("opacity", 1); });

        // Block 9: Optional Enhancements (Icons, X-Category Labels)
        // Icons (Flags)
        const iconGroups = chartGroup.selectAll(".icon-group")
            .data(xScale.domain()) // Use scale domain to ensure all categories are considered
            .enter()
            .append("g")
            .attr("class", "icon icon-group")
            .attr("transform", d => `translate(${xScale(d) + xScale.bandwidth() / 2}, ${innerHeight + 25})`);

        iconGroups.each(function(d) {
            const iconUrl = fillStyle.imageUrls[d];
            if (iconUrl) {
                const radius = Math.min(xScale.bandwidth() * 0.45, 15); // Max radius 15px
                const imageSize = radius * 1.8; // Image slightly smaller than circle diameter

                d3.select(this).append("circle")
                    .attr("class", "icon-background")
                    .attr("r", radius)
                    .attr("fill", fillStyle.iconCircleFill)
                    .attr("stroke", fillStyle.iconCircleStroke)
                    .attr("stroke-width", 1);

                d3.select(this).append("image")
                    .attr("class", "image icon-image")
                    .attr("xlink:href", iconUrl)
                    .attr("x", -imageSize / 2)
                    .attr("y", -imageSize / 2)
                    .attr("width", imageSize)
                    .attr("height", imageSize)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        });
        
        // X-Category Labels (below icons)
        const checkLabelFits = (text, bandWidth) => {
            if (!text) return true;
            const textWidth = estimateTextWidth(text.toString(), fillStyle.typography.label);
            return textWidth < bandWidth; 
        };

        const showXLabels = xScale.domain().every(item =>
            checkLabelFits(item, xScale.bandwidth())
        );

        if (showXLabels) {
            chartGroup.selectAll(".x-category-label")
                .data(xScale.domain())
                .enter()
                .append("text")
                .attr("class", "label x-category-label")
                .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
                .attr("y", innerHeight + 55) // Position below icons
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.label.fontFamily)
                .style("font-size", fillStyle.typography.label.fontSize)
                .style("font-weight", fillStyle.typography.label.fontWeight)
                .style("fill", fillStyle.textColor)
                .text(d => d);
        }
    }

    // Render Left Chart
    const leftChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);
    renderSubChart(leftChartGroup, leftChartData, leftXScale, leftYScale, fillStyle.primaryBarColor, yField, yUnit, true);

    // Render Right Chart
    const rightChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left + subChartWidth + 40}, ${chartMargins.top})`); // 40 is spacing
    renderSubChart(rightChartGroup, rightChartData, rightXScale, rightYScale, fillStyle.secondaryBarColor, y2Field, y2Unit, false);

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
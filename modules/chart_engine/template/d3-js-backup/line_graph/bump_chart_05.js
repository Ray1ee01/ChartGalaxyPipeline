/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bump Chart",
  "chart_name": "bump_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 12], [0, "inf"], [4, 10]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || (data.colors_dark || {}); // Assuming dark theme might be passed
    const imagesConfig = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    if (!xFieldConfig || !yFieldConfig || !groupFieldConfig) {
        const missingFields = [
            !xFieldConfig ? "x role" : null,
            !yFieldConfig ? "y role" : null,
            !groupFieldConfig ? "group role" : null,
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: data columns for roles [${missingFields}] not found. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) || '16px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        axisLabelColor: colorsConfig.text_color || '#555555',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Not directly used on SVG, but for consistency
        defaultLineStrokeWidth: 3,
        defaultCircleStroke: '#FFFFFF',
        defaultCircleStrokeWidth: 2,
    };

    const getGroupColor = (groupName) => {
        if (colorsConfig.field && colorsConfig.field[groupName]) {
            return colorsConfig.field[groupName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            // Simple hash to pick a color, or use index if groups are consistently ordered
            let hash = 0;
            for (let i = 0; i < groupName.length; i++) {
                hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
            }
            const index = Math.abs(hash) % colorsConfig.available_colors.length;
            return colorsConfig.available_colors[index];
        }
        return colorsConfig.other && colorsConfig.other.primary ? colorsConfig.other.primary : '#888888';
    };

    const estimateTextWidth = (text, fontSize, fontFamily, fontWeight) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-size', fontSize || fillStyle.typography.labelFontSize);
        textNode.setAttribute('font-family', fontFamily || fillStyle.typography.labelFontFamily);
        textNode.setAttribute('font-weight', fontWeight || fillStyle.typography.labelFontWeight);
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Note: Appending to body and then removing is more reliable for getComputedTextLength/getBBox
        // but per spec, strictly in-memory. getBBox should work.
        // document.body.appendChild(svg); // Temporarily append
        const width = textNode.getBBox().width;
        // document.body.removeChild(svg); // Clean up
        return width;
    };
    
    const parseDate = (dateString) => {
        // Attempt to parse common date formats. d3.isoParse is good for ISO 8601.
        // If dates are in another format, this might need adjustment or configuration.
        const parsed = d3.isoParse(dateString) || new Date(dateString);
        return parsed instanceof Date && !isNaN(parsed) ? parsed : null;
    };

    const getLuminance = (color) => {
        const rgb = d3.color(color).rgb();
        return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground); // Optional: set background on SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 180, bottom: 60, left: 100 }; // Adjusted left for potentially longer group names
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]), // Ensure x values are dates
        [yFieldName]: +d[yFieldName] // Ensure y values are numbers
    })).filter(d => d[xFieldName] !== null); // Filter out unparseable dates

    if (chartData.length === 0) {
        const errorMessage = "No valid data points after parsing. Cannot render.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }


    const groups = [...new Set(chartData.map(d => d[groupFieldName]))].sort();
    const xValuesUniqueSorted = [...new Set(chartData.map(d => d[xFieldName].getTime()))]
                                .map(time => new Date(time))
                                .sort((a, b) => a - b);

    const rankData = {};
    groups.forEach(group => { rankData[group] = []; });

    xValuesUniqueSorted.forEach(xDate => {
        const itemsAtX = chartData.filter(d => d[xFieldName].getTime() === xDate.getTime());
        itemsAtX.sort((a, b) => b[yFieldName] - a[yFieldName]); // Higher Y = better rank

        const rankByGroupAtX = {};
        itemsAtX.forEach((item, i) => {
            rankByGroupAtX[item[groupFieldName]] = i + 1; // Rank 1 is best
        });

        groups.forEach(group => {
            const currentItem = itemsAtX.find(d => d[groupFieldName] === group);
            if (currentItem) {
                rankData[group].push({
                    x: xDate,
                    rank: rankByGroupAtX[group],
                    value: currentItem[yFieldName],
                    missing: false
                });
            } else {
                // Handle missing data: try to carry forward last known rank
                let lastKnownRank = groups.indexOf(group) + 1; // Default to initial position
                if (rankData[group].length > 0) {
                    const lastValidPoint = [...rankData[group]].reverse().find(p => !p.missing);
                    if (lastValidPoint) lastKnownRank = lastValidPoint.rank;
                }
                rankData[group].push({
                    x: xDate,
                    rank: lastKnownRank,
                    value: null,
                    missing: true
                });
            }
        });
    });

    groups.forEach(group => {
        rankData[group].sort((a, b) => a.x - b.x);
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(xValuesUniqueSorted))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([1, Math.max(1, groups.length)]) // Domain from rank 1 to max groups
        .range([0, innerHeight]);

    const yValuesNumeric = chartData.map(d => d[yFieldName]).filter(v => typeof v === 'number' && !isNaN(v));
    const yValueMin = yValuesNumeric.length > 0 ? Math.min(...yValuesNumeric) : 0;
    const yValueMax = yValuesNumeric.length > 0 ? Math.max(...yValuesNumeric) : 1; // Avoid 0 domain if all values are same
    
    const radiusScale = d3.scaleLinear()
        .domain([yValueMin, yValueMax === yValueMin ? yValueMin + 1 : yValueMax]) // Ensure domain is not zero-width
        .range([5, Math.min(20, innerHeight / (groups.length * 2 * 1.5) )]); // Radius range, cap at reasonable size


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Top Time Labels (X-Axis Minimal)
    const xAxisTicksGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis");

    const timeTickFormat = xScale.ticks(Math.min(xValuesUniqueSorted.length, 7)).length > 5 ? d3.timeFormat("%b %y") : d3.timeFormat("%Y-%m-%d");
    // Simple tick optimization: show fewer ticks if space is tight
    let xTicks = xScale.ticks(Math.min(xValuesUniqueSorted.length, Math.floor(innerWidth / 80))); 
    if (xTicks.length > 10) xTicks = xScale.ticks(10); // Max 10 ticks
    if (xValuesUniqueSorted.length <= 2 && xTicks.length < xValuesUniqueSorted.length) xTicks = xValuesUniqueSorted;


    xTicks.forEach(tick => {
        xAxisTicksGroup.append("text")
            .attr("class", "label axis-label")
            .attr("x", xScale(tick))
            .attr("y", -chartMargins.top / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.axisLabelColor)
            .text(timeTickFormat(tick));
    });

    // Left Group Labels & Ranks (Y-Axis Minimal)
    const yAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    const maxGroupNameWidth = groups.reduce((max, group) => {
        return Math.max(max, estimateTextWidth(group, "16px", fillStyle.typography.labelFontFamily, "bold"));
    }, 0);

    const rankLabelWidth = estimateTextWidth("99", "14px", fillStyle.typography.labelFontFamily, "bold"); // Max 2 digits for rank
    const triangleWidth = 10;
    const labelPadding = 5;

    groups.forEach((group, i) => {
        const groupRank = i + 1; // Initial rank for positioning labels
        const yPos = yScale(groupRank); // Use initial rank for label Y to avoid overlap if data starts sparse

        // Group Rank Number
        yAxisLabelsGroup.append("text")
            .attr("class", "label rank-label")
            .attr("x", -rankLabelWidth - triangleWidth - labelPadding - maxGroupNameWidth - labelPadding) // Position to the far left
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", "14px") // Slightly smaller than group name
            .style("font-weight", "bold")
            .attr("fill", fillStyle.textColor)
            .text(groupRank);

        // Group Name
        yAxisLabelsGroup.append("text")
            .attr("class", "label group-label")
            .attr("x", -triangleWidth - labelPadding) // Position left of triangle
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .attr("fill", getGroupColor(group))
            .text(group);

        // Triangle Marker
        yAxisLabelsGroup.append("path")
            .attr("class", "mark group-marker")
            .attr("d", "M0,-5 L10,0 L0,5 Z") // Triangle pointing right
            .attr("transform", `translate(${-triangleWidth / 2}, ${yPos})`)
            .attr("fill", getGroupColor(group));
    });


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.rank))
        .defined(d => !d.missing);

    groups.forEach(group => {
        const groupData = rankData[group];
        const groupColor = getGroupColor(group);
        const groupSpecificClass = `group-path-${group.replace(/\s+/g, '-').toLowerCase()}`; // CSS-friendly class

        // Lines
        mainChartGroup.append("path")
            .datum(groupData)
            .attr("class", `mark line ${groupSpecificClass}`)
            .attr("fill", "none")
            .attr("stroke", groupColor)
            .attr("stroke-width", fillStyle.defaultLineStrokeWidth)
            .attr("d", lineGenerator);

        // Circles for actual data points
        mainChartGroup.selectAll(`.mark.circle.${groupSpecificClass}`)
            .data(groupData.filter(d => !d.missing))
            .enter()
            .append("circle")
            .attr("class", `mark circle ${groupSpecificClass}`)
            .attr("cx", d => xScale(d.x))
            .attr("cy", d => yScale(d.rank))
            .attr("r", d => radiusScale(d.value))
            .attr("fill", groupColor)
            .attr("stroke", fillStyle.defaultCircleStroke)
            .attr("stroke-width", fillStyle.defaultCircleStrokeWidth);

        // Value Labels on Circles
        mainChartGroup.selectAll(`.label.value.${groupSpecificClass}`)
            .data(groupData.filter(d => !d.missing && d.value !== null))
            .enter()
            .append("text")
            .attr("class", `label value ${groupSpecificClass}`)
            .attr("x", d => xScale(d.x))
            .attr("y", d => {
                const radius = radiusScale(d.value);
                return radius < 10 ? yScale(d.rank) - radius - 5 : yScale(d.rank); // Above small circles, inside large
            })
            .attr("dy", d => (radiusScale(d.value) < 10 ? "0" : "0.35em"))
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", d => {
                if (radiusScale(d.value) < 10) {
                    return fillStyle.textColor; // Outside small circles
                }
                return getLuminance(groupColor) > 0.5 ? '#000000' : '#FFFFFF'; // Contrast for inside large circles
            })
            .text(d => Math.round(d.value));
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this specific refactoring beyond what's in Block 7 & 8)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
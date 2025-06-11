/* REQUIREMENTS_BEGIN
{
  "chart_type": "Diverging Area Chart",
  "chart_name": "diverging_area_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data?.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; 
    const images = data.images || {}; // Not used, but adhere to structure
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); 

    const timeFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!timeFieldDef) missingFields.push("x role field");
    if (!valueFieldDef) missingFields.push("y role field");
    if (!groupFieldDef) missingFields.push("group role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    const timeField = timeFieldDef.name;
    const valueField = valueFieldDef.name;
    const groupField = groupFieldDef.name;
    
    if (!rawChartData || rawChartData.length === 0) {
        const errorMsg = "Chart data is missing or empty. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        groupColors: {} 
    };

    fillStyle.textColor = colors.text_color || '#333333';
    fillStyle.axisLineColor = colors.text_color || '#333333'; 
    fillStyle.chartBackground = colors.background_color || '#FFFFFF'; 

    fillStyle.typography = {
        axisLabel: {
            font_family: typography.label?.font_family || 'Arial, sans-serif',
            font_size: typography.label?.font_size || '12px',
            font_weight: typography.label?.font_weight || 'normal',
        },
        legendLabel: { 
            font_family: typography.label?.font_family || 'Arial, sans-serif',
            font_size: typography.label?.font_size || '12px', 
            font_weight: typography.label?.font_weight || 'normal', 
        }
    };
    
    const parseDate = d => {
        if (d instanceof Date) return d;
        if (typeof d === 'number') return new Date(d, 0, 1); 
        if (typeof d === 'string') {
            const parts = d.split(/[-/]/); 
            if (parts.length === 3) return new Date(+parts[0], +parts[1] - 1, +parts[2]);
            if (parts.length === 2) return new Date(+parts[0], +parts[1] - 1, 1);
            if (parts.length === 1 && /^\d{4}$/.test(parts[0])) return new Date(+parts[0], 0, 1);
        }
        return new Date(); 
    };

    const estimateTextWidth = (text, fontProps) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontProps.font_family);
        tempTextElement.setAttribute('font-size', fontProps.font_size);
        tempTextElement.setAttribute('font-weight', fontProps.font_weight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        let width = 0;
        try {
            width = tempTextElement.getBBox().width;
        } catch (e) {
            width = text.length * (parseInt(fontProps.font_size, 10) * 0.6); 
        }
        return width;
    };

    const createTimeAxisLogic = (inputData, timeFieldString, rangeStart = 0, rangeEnd = 100, padding = 0.05) => {
        const dates = inputData.map(d => parseDate(d[timeFieldString]));
        const [minD, maxD] = d3.extent(dates);

        if (minD === undefined || maxD === undefined) {
             return {
                scale: d3.scaleTime().domain([new Date(), new Date()]).range([rangeStart, rangeEnd]),
                ticks: [],
                format: d => d3.timeFormat("%Y-%m-%d")(d),
                timeSpan: { days: 0, months: 0, years: 0 }
            };
        }

        const span = +maxD - +minD;
        const daySpan = span / 86400000;
        const monthSpan = daySpan / 30;
        const yearSpan = daySpan / 365;
        const padAmount = span * padding;
    
        const scale = d3.scaleTime()
            .domain([new Date(+minD - padAmount), new Date(+maxD + padAmount)])
            .range([rangeStart, rangeEnd]); 
    
        let interval, format;
        if (yearSpan > 35) { interval = d3.timeYear.every(10); format = d => d3.timeFormat("%Y")(d); }
        else if (yearSpan > 15) { interval = d3.timeYear.every(5); format = d => d3.timeFormat("%Y")(d); }
        else if (yearSpan > 7) { interval = d3.timeYear.every(2); format = d => d3.timeFormat("%Y")(d); }
        else if (yearSpan > 2) { interval = d3.timeYear.every(1); format = d => d3.timeFormat("%Y")(d); }
        else if (yearSpan > 1) { interval = d3.timeMonth.every(3); format = d => `${d.getFullYear().toString().slice(-2)}Q${Math.floor(d.getMonth()/3)+1}`; }
        else if (monthSpan > 6) { interval = d3.timeMonth.every(1); format = d => d3.timeFormat("%b %Y")(d); }
        else if (monthSpan > 2) { interval = d3.timeWeek.every(1); format = d => d3.timeFormat("%d %b")(d); }
        else { 
            const c = Math.max(1, Math.ceil(daySpan / 10)); 
            interval = d3.timeDay.every(c); 
            format = d => d3.timeFormat("%d %b")(d); 
        }
    
        const ticks = scale.ticks(interval);
        
        if (ticks.length > 0) {
            if (maxD > ticks[ticks.length - 1]) {
                const lastTickScreenPos = scale(ticks[ticks.length - 1]);
                const maxDateScreenPos = scale(maxD);
                if (Math.abs(maxDateScreenPos - lastTickScreenPos) >= 40) { // Min 40px for a new tick
                    ticks.push(maxD);
                } else {
                    ticks[ticks.length - 1] = maxD;
                }
            }
            if (minD < ticks[0]) {
                const firstTickScreenPos = scale(ticks[0]);
                const minDateScreenPos = scale(minD);
                if (Math.abs(minDateScreenPos - firstTickScreenPos) >= 40) {
                    ticks.unshift(minD);
                } else {
                    ticks[0] = minD;
                }
            }
        }


        return { scale, ticks, format, timeSpan: { days: daySpan, months: monthSpan, years: yearSpan } };
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root") 
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 20, bottom: 80, left: 20 }; 
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const centerGutterWidth = 60; 
    const halfGutterWidth = centerGutterWidth / 2;

    // Block 5: Data Preprocessing & Transformation
    const chartData = rawChartData.map(d => ({
        ...d,
        [timeField]: parseDate(d[timeField]), 
        [valueField]: +d[valueField] 
    }));

    let uniqueGroups = [...new Set(chartData.map(d => d[groupField]))];
    
    if (uniqueGroups.length !== 2) {
        const errorMsg = `This chart requires exactly 2 groups. Found ${uniqueGroups.length} groups (${uniqueGroups.join(', ')}). Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    uniqueGroups.sort(); 

    uniqueGroups.forEach((group, i) => {
        if (colors.field && colors.field[group]) {
            fillStyle.groupColors[group] = colors.field[group];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            fillStyle.groupColors[group] = colors.available_colors[i % colors.available_colors.length];
        } else {
            fillStyle.groupColors[group] = d3.schemeCategory10[i % 10]; 
        }
    });

    // Block 6: Scale Definition & Configuration
    const { scale: timeScale, ticks: timeTicks, format: timeFormat } = 
        createTimeAxisLogic(chartData, timeField, 0, innerHeight); 

    const maxValue = d3.max(chartData, d => d[valueField]) || 0; 
    const valueScaleDomainMax = maxValue * 1.1 || 1; 

    const valueScaleLeft = d3.scaleLinear()
        .domain([0, valueScaleDomainMax])
        .range([innerWidth / 2 - halfGutterWidth, 0]); 

    const valueScaleRight = d3.scaleLinear()
        .domain([0, valueScaleDomainMax])
        .range([innerWidth / 2 + halfGutterWidth, innerWidth]); 

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const timeAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis time-axis");

    timeTicks.forEach(tick => {
        const tickGroup = timeAxisGroup.append("g").attr("class", "tick-group");
        
        tickGroup.append("text")
            .attr("class", "label axis-label")
            .attr("x", innerWidth / 2)
            .attr("y", timeScale(tick))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.axisLabel.font_family)
            .style("font-size", fillStyle.typography.axisLabel.font_size)
            .style("font-weight", fillStyle.typography.axisLabel.font_weight)
            .text(timeFormat(tick));
        
        tickGroup.append("line")
            .attr("class", "mark axis-tick-line")
            .attr("x1", innerWidth / 2 - halfGutterWidth - 10)
            .attr("y1", timeScale(tick))
            .attr("x2", innerWidth / 2 - halfGutterWidth)
            .attr("y2", timeScale(tick))
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);
        
        tickGroup.append("line")
            .attr("class", "mark axis-tick-line")
            .attr("x1", innerWidth / 2 + halfGutterWidth)
            .attr("y1", timeScale(tick))
            .attr("x2", innerWidth / 2 + halfGutterWidth + 10)
            .attr("y2", timeScale(tick))
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);
    });

    const valueAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis value-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    const valueTicks = d3.ticks(0, valueScaleDomainMax, 5); 
    valueTicks.forEach(tick => {
        valueAxisGroup.append("text")
            .attr("class", "label axis-label")
            .attr("x", valueScaleLeft(tick))
            .attr("y", 20) 
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.axisLabel.font_family)
            .style("font-size", fillStyle.typography.axisLabel.font_size)
            .style("font-weight", fillStyle.typography.axisLabel.font_weight)
            .text(tick);

        if (valueScaleLeft(tick) !== valueScaleRight(tick)) { // Avoid duplicate '0' if scales met, though not here
             valueAxisGroup.append("text")
                .attr("class", "label axis-label")
                .attr("x", valueScaleRight(tick))
                .attr("y", 20) 
                .attr("text-anchor", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.axisLabel.font_family)
                .style("font-size", fillStyle.typography.axisLabel.font_size)
                .style("font-weight", fillStyle.typography.axisLabel.font_weight)
                .text(tick);
        }
    });

    const legendContainerGroup = svgRoot.append("g")
        .attr("class", "legend-container")
        .attr("transform", `translate(0, ${containerHeight - chartMargins.bottom + 40})`); 

    const legendItems = uniqueGroups.map(groupName => {
        const textWidth = estimateTextWidth(groupName, fillStyle.typography.legendLabel);
        return {
            label: groupName,
            color: fillStyle.groupColors[groupName],
            width: 16 + 10 + textWidth + 20 
        };
    });
    
    const totalLegendWidth = legendItems.reduce((sum, item) => sum + item.width, 0) - (legendItems.length > 0 ? 20 : 0); 
    const legendStartX = (containerWidth - totalLegendWidth) / 2;
    
    let currentX = legendStartX;
    legendItems.forEach(item => {
        const legendItemGroup = legendContainerGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);
        
        legendItemGroup.append("rect")
            .attr("class", "mark legend-swatch")
            .attr("x", 0)
            .attr("y", -8) 
            .attr("width", 16)
            .attr("height", 16)
            .attr("fill", item.color);
        
        legendItemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", 16 + 10) 
            .attr("y", 0) 
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.legendLabel.font_family)
            .style("font-size", fillStyle.typography.legendLabel.font_size)
            .style("font-weight", fillStyle.typography.legendLabel.font_weight)
            .text(item.label);
        
        currentX += item.width;
    });

    // Block 8: Main Data Visualization Rendering (Areas)
    const areasGroup = mainChartGroup.append("g").attr("class", "areas-group");

    uniqueGroups.forEach((groupName, i) => {
        const groupData = chartData
            .filter(d => d[groupField] === groupName)
            .sort((a, b) => a[timeField] - b[timeField]); 

        const valueScale = i === 0 ? valueScaleLeft : valueScaleRight;
        const areaBaselineX = i === 0 ? innerWidth / 2 - halfGutterWidth : innerWidth / 2 + halfGutterWidth;
        
        const areaGenerator = d3.area()
            .x0(areaBaselineX)
            .x1(d => valueScale(d[valueField]))
            .y(d => timeScale(d[timeField])) 
            .curve(d3.curveLinear);
        
        areasGroup.append("path")
            .datum(groupData)
            .attr("class", "mark data-area")
            .attr("fill", fillStyle.groupColors[groupName])
            .attr("d", areaGenerator);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
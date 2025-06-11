/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Stacked Area Chart",
  "chart_name": "stacked_area_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 10]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END
*/



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data;
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors_dark || data.colors || {}; // Prioritize dark theme if available
    const rawImages = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldConfig = dataColumns.find(col => col.role === xFieldRole);
    const yFieldConfig = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldConfig = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldConfig?.name;
    const yFieldName = yFieldConfig?.name;
    const groupFieldName = groupFieldConfig?.name;
    
    const yAxisTitleText = variables.y_axis_title || yFieldConfig?.title || yFieldName;


    if (!xFieldName || !yFieldName || !groupFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!yFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        if (!groupFieldName) missingFields.push(`field with role '${groupFieldRole}'`);
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (!chartDataInput || chartDataInput.length === 0) {
        const errorMsg = "Chart data is missing or empty. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: rawColors.background_color || '#121212',
        textColor: rawColors.text_color || '#E0E0E0',
        axisLineColor: rawColors.text_color || '#B0B0B0',
        gridLineColor: (rawColors.other && rawColors.other.gridColor) || '#FFFFFF',
        gridLineOpacity: (rawColors.other && typeof rawColors.other.gridOpacity === 'number') ? rawColors.other.gridOpacity : 0.15,
        getCategoryColor: (groupName, index) => {
            if (rawColors.field && rawColors.field[groupName]) {
                return rawColors.field[groupName];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[index % rawColors.available_colors.length];
            }
            return d3.schemeCategory10[index % d3.schemeCategory10.length];
        },
        getImageUrl: (groupName) => {
            if (rawImages.field && rawImages.field[groupName]) {
                return rawImages.field[groupName];
            }
            return null;
        },
        typography: {
            axisTick: {
                fontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
                fontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
                fontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            },
            axisTitle: {
                fontFamily: (rawTypography.title && rawTypography.title.font_family) || 'Arial, sans-serif',
                fontSize: (rawTypography.title && rawTypography.title.font_size) || '14px',
                fontWeight: (rawTypography.title && rawTypography.title.font_weight) || 'bold',
            },
            dataLabel: { 
                fontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
                fontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '14px',
                fontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
            }
        }
    };

    function parseDateInternal(dateString) {
        if (dateString === null || typeof dateString === 'undefined') return null;
        let date = new Date(dateString); // Handles ISO strings, YYYY-MM-DD, milliseconds
        if (!isNaN(date.getTime())) {
            return date;
        }
        const yearNum = parseInt(dateString, 10); // Try parsing as a year number
        if (!isNaN(yearNum) && yearNum > 1000 && yearNum < 3000) {
             return new Date(yearNum, 0, 1); // Year, month 0 (Jan), day 1
        }
        // Add more specific parsers if needed, e.g., using d3.timeParse
        // console.warn(`Could not parse date: ${dateString}`); // Optional warning
        return null;
    }

    function createXAxisScaleAndTicksHelper(currentChartData, currentXFieldName, chartRangeMin, chartRangeMax, parseDateFunc) {
        const dates = currentChartData.map(d => parseDateFunc(d[currentXFieldName])).filter(d => d !== null).sort(d3.ascending);
        
        let domain;
        if (dates.length === 0) {
            const now = new Date();
            domain = [now, d3.timeDay.offset(now, 1)]; // Default 1-day domain
        } else if (dates.length === 1) {
            domain = [d3.timeDay.offset(dates[0], -1), d3.timeDay.offset(dates[0], 1)]; // +/- 1 day for single point
        } else {
            domain = d3.extent(dates);
        }

        const xScale = d3.scaleTime().domain(domain).range([chartRangeMin, chartRangeMax]);
        const targetTickWidth = variables.x_axis_target_tick_width || 80; // pixels
        const numTicksTarget = Math.max(2, Math.min(10, Math.floor((chartRangeMax - chartRangeMin) / targetTickWidth)));
        const xTickValues = xScale.ticks(numTicksTarget);
        const xTickFormat = xScale.tickFormat(numTicksTarget);

        return { xScale, xTickValues, xTickFormat };
    }

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
    const chartMargins = { 
        top: variables.margin_top || 20, 
        right: variables.margin_right || 60, 
        bottom: variables.margin_bottom || 50,
        left: variables.margin_left || 80
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Adjust margins or container size.";
        console.error(errorMsg);
         d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }


    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({...d})); 

    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))]
        .sort((a, b) => {
            const avgA = d3.mean(chartDataArray.filter(d => d[groupFieldName] === a), d => parseFloat(d[yFieldName]));
            const avgB = d3.mean(chartDataArray.filter(d => d[groupFieldName] === b), d => parseFloat(d[yFieldName]));
            return (avgA || 0) - (avgB || 0); 
        });

    const groupedDataByX = d3.group(chartDataArray, d => d[xFieldName]);
    
    const stackInputData = Array.from(groupedDataByX, ([key, values]) => {
        const obj = { date: parseDateInternal(key) };
        values.forEach(v => {
            obj[v[groupFieldName]] = parseFloat(v[yFieldName]) || 0; // Ensure numeric, default to 0
        });
        return obj;
    }).filter(d => d.date !== null); 
    
    stackInputData.forEach(d => {
        groups.forEach(group => {
            if (d[group] === undefined) {
                d[group] = 0; 
            }
        });
    });
    
    stackInputData.sort((a, b) => a.date - b.date);
    
    const stackGenerator = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) 
        .offset(d3.stackOffsetNone);
    
    const stackedDataSeries = stackGenerator(stackInputData);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTickValues, xTickFormat } = createXAxisScaleAndTicksHelper(chartDataArray, xFieldName, 0, innerWidth, parseDateInternal);
    
    const yMaxStackedValue = d3.max(stackedDataSeries[stackedDataSeries.length - 1] || [], d => d[1]);
    const yMax = (yMaxStackedValue !== undefined && !isNaN(yMaxStackedValue) ? yMaxStackedValue : 0) * 1.1 || 10; 
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering
    const yNumTicks = variables.y_axis_num_ticks || 5;
    const yAxisTicks = yScale.ticks(yNumTicks);
    const yAxis = d3.axisLeft(yScale)
        .tickValues(yAxisTicks)
        .tickFormat(d3.format(".1s"));

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.selectAll("path").style("stroke", fillStyle.axisLineColor);
    yAxisGroup.selectAll("line").style("stroke", fillStyle.axisLineColor);
    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.axisTick.fontFamily)
        .style("font-size", fillStyle.typography.axisTick.fontSize)
        .style("font-weight", fillStyle.typography.axisTick.fontWeight);

    mainChartGroup.append("g")
        .attr("class", "grid y-grid")
        .call(d3.axisLeft(yScale)
            .tickValues(yAxisTicks)
            .tickSize(-innerWidth)
            .tickFormat("")
        )
        .selectAll("line")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-opacity", fillStyle.gridLineOpacity);
    mainChartGroup.select(".y-grid .domain").remove();

    const xAxis = d3.axisBottom(xScale)
        .tickValues(xTickValues)
        .tickFormat(xTickFormat);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("path").style("stroke", fillStyle.axisLineColor);
    xAxisGroup.selectAll("line").style("stroke", fillStyle.axisLineColor);
    xAxisGroup.selectAll("text")
        .attr("class", "label x-axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.axisTick.fontFamily)
        .style("font-size", fillStyle.typography.axisTick.fontSize)
        .style("font-weight", fillStyle.typography.axisTick.fontWeight);
    
    if (yAxisTitleText) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title y-axis-title")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - chartMargins.left)
            .attr("x", 0 - (innerHeight / 2))
            .attr("dy", "1em") 
            .style("text-anchor", "middle")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.axisTitle.fontFamily)
            .style("font-size", fillStyle.typography.axisTitle.fontSize)
            .style("font-weight", fillStyle.typography.axisTitle.fontWeight)
            .text(yAxisTitleText);
    }

    // Block 8: Main Data Visualization Rendering
    const areaGenerator = d3.area()
        .x(d => xScale(d.data.date))
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]))
        .curve(d3.curveLinear);

    mainChartGroup.selectAll(".area-path")
        .data(stackedDataSeries)
        .enter().append("path")
        .attr("class", d => `mark area-path area-${d.key.toString().replace(/\W+/g, '-').toLowerCase()}`) // Sanitize class name
        .attr("fill", (d, i) => fillStyle.getCategoryColor(d.key, i))
        .attr("d", areaGenerator);

    // Block 9: Optional Enhancements & Post-Processing
    const MIN_HEIGHT_FOR_IMAGE = variables.min_height_for_image || 70;
    const IMAGE_SIZE = variables.image_size || 60;
    const LABEL_IMAGE_GRID_SIZE = variables.label_placement_grid_size || 10; 

    stackedDataSeries.forEach((seriesData) => {
        const groupName = seriesData.key;
        const imageUrl = fillStyle.getImageUrl(groupName);

        if (seriesData.length === 0) return;

        let gridInterpolations = [];
        const numGrids = Math.floor(innerWidth / LABEL_IMAGE_GRID_SIZE);

        for (let gridIdx = 0; gridIdx < numGrids; gridIdx++) {
            const gridX = gridIdx * LABEL_IMAGE_GRID_SIZE;
            const gridDate = xScale.invert(gridX);
            
            let leftIdx = -1, rightIdx = -1;
            for (let j = 0; j < seriesData.length - 1; j++) {
                if (seriesData[j].data.date <= gridDate && seriesData[j+1].data.date >= gridDate) {
                    leftIdx = j; rightIdx = j + 1; break;
                }
            }
            if (leftIdx === -1 && seriesData.length > 0) {
                if (gridDate <= seriesData[0].data.date) { leftIdx = 0; rightIdx = 0; }
                else if (gridDate >= seriesData[seriesData.length - 1].data.date) { leftIdx = seriesData.length - 1; rightIdx = seriesData.length - 1; }
            }
             if (leftIdx === -1 && seriesData.length === 1) { leftIdx = 0; rightIdx = 0; }


            if (leftIdx !== -1) {
                const dpL = seriesData[leftIdx], dpR = seriesData[rightIdx];
                let ratio = 0;
                if (dpL.data.date < dpR.data.date) {
                    ratio = (gridDate - dpL.data.date) / (dpR.data.date - dpL.data.date);
                    ratio = Math.max(0, Math.min(1, ratio)); 
                }
                
                const y0 = d3.interpolateNumber(dpL[0], dpR[0])(ratio);
                const y1 = d3.interpolateNumber(dpL[1], dpR[1])(ratio);
                
                gridInterpolations.push({
                    gridX: gridX,
                    y0_scaled: yScale(y0),
                    y1_scaled: yScale(y1),
                    segmentHeight: Math.abs(yScale(y0) - yScale(y1)) 
                });
            }
        }

        if (gridInterpolations.length === 0) return;

        let avgSegmentHeights = [];
        const movingAvgWindow = 5;
        for (let i = 0; i < gridInterpolations.length; i++) {
            let sumHeight = 0, count = 0;
            for (let j = Math.max(0, i - movingAvgWindow); j <= Math.min(gridInterpolations.length - 1, i + movingAvgWindow); j++) {
                sumHeight += gridInterpolations[j].segmentHeight;
                count++;
            }
            avgSegmentHeights.push({
                gridX: gridInterpolations[i].gridX,
                avgHeight: count > 0 ? sumHeight / count : 0,
                y0_scaled: gridInterpolations[i].y0_scaled,
                y1_scaled: gridInterpolations[i].y1_scaled
            });
        }
        
        if (avgSegmentHeights.length === 0) return;

        let maxWeightedHeight = -1;
        let bestPosition = null;
        const searchStartIndex = Math.floor(avgSegmentHeights.length / 2);

        for (let i = searchStartIndex; i < avgSegmentHeights.length; i++) {
            const weightedHeight = avgSegmentHeights[i].avgHeight + (0.1 * i); 
            if (weightedHeight > maxWeightedHeight) {
                maxWeightedHeight = weightedHeight;
                bestPosition = avgSegmentHeights[i];
            }
        }
        if (!bestPosition && avgSegmentHeights.length > 0) {
            bestPosition = avgSegmentHeights.reduce((p, c) => (p.avgHeight > c.avgHeight) ? p : c, avgSegmentHeights[0]);
        }
        
        if (!bestPosition || bestPosition.avgHeight < (IMAGE_SIZE / 3) ) return;

        const labelX = bestPosition.gridX;
        const segmentCenterY = bestPosition.y1_scaled + (bestPosition.y0_scaled - bestPosition.y1_scaled) * 0.5;
        let finalLabelTextY = segmentCenterY;

        const canPlaceImage = imageUrl && bestPosition.avgHeight >= MIN_HEIGHT_FOR_IMAGE;

        if (canPlaceImage) {
            const textYOffsetDueToImage = variables.text_y_offset_for_image || 25;
            finalLabelTextY = segmentCenterY + textYOffsetDueToImage;

            mainChartGroup.append("image")
                .attr("class", "image data-image")
                .attr("x", labelX - IMAGE_SIZE / 2)
                .attr("y", finalLabelTextY - IMAGE_SIZE - 5) 
                .attr("width", IMAGE_SIZE)
                .attr("height", IMAGE_SIZE)
                .attr("xlink:href", imageUrl)
                .style("pointer-events", "none");
        }

        mainChartGroup.append("text")
            .attr("class", "label data-label")
            .attr("x", labelX)
            .attr("y", finalLabelTextY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.dataLabel.fontFamily)
            .style("font-size", fillStyle.typography.dataLabel.fontSize)
            .style("font-weight", fillStyle.typography.dataLabel.fontWeight)
            .style("opacity", 0.85)
            .text(groupName);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
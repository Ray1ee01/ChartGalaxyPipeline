/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Spline Chart",
  "chart_name": "radial_spline_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data;
    const variables = data.variables || {};
    const dataTypography = data.typography || {};
    const dataColors = data.colors || {};
    const dataImages = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: categoryField (role 'x') or valueField (role 'y') not found in dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing. Category or value field not defined.</div>");
        }
        return null;
    }
    if (!chartDataInput || chartDataInput.length === 0) {
        console.warn("Data is empty or not provided. Cannot render.");
         if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:orange; text-align:center; padding: 20px;'>Warning: No data provided to render the chart.</div>");
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    fillStyle.primaryColor = (dataColors.other && dataColors.other.primary) ? dataColors.other.primary : '#1f77b4';
    fillStyle.gridLineColor = '#CCCCCC';
    fillStyle.textColor = dataColors.text_color || '#333333';
    fillStyle.pointStrokeColor = dataColors.background_color || '#FFFFFF'; // Contrast for point border
    fillStyle.chartBackground = dataColors.background_color || 'transparent';
    
    fillStyle.typography = {
        labelFontFamily: (dataTypography.label && dataTypography.label.font_family) ? dataTypography.label.font_family : 'Arial, sans-serif',
        labelFontSize: (dataTypography.label && dataTypography.label.font_size) ? dataTypography.label.font_size : '16px',
        labelFontWeight: (dataTypography.label && dataTypography.label.font_weight) ? dataTypography.label.font_weight : 'bold',

        annotationFontFamily: (dataTypography.annotation && dataTypography.annotation.font_family) ? dataTypography.annotation.font_family : 'Arial, sans-serif',
        annotationFontSize: (dataTypography.annotation && dataTypography.annotation.font_size) ? dataTypography.annotation.font_size : '14px',
        annotationFontWeight: (dataTypography.annotation && dataTypography.annotation.font_weight) ? dataTypography.annotation.font_weight : 'normal',
    };
    
    fillStyle.categoryLabelTextColor = fillStyle.textColor;
    fillStyle.tickLabelTextColor = dataColors.text_color ? d3.color(dataColors.text_color).darker(0.5).toString() : '#666666';
    fillStyle.valueLabelTextColor = dataColors.text_color_on_primary || '#FFFFFF';
    fillStyle.valueLabelBackgroundColor = fillStyle.primaryColor;

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.position = 'absolute'; tempSvg.style.visibility = 'hidden'; // Not strictly needed for non-DOM SVG
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        const width = textElement.getBBox().width;
        return width;
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 50, bottom: 50, left: 50 };
    if (containerWidth < 200 || containerHeight < 200) { // Adjust margins for very small charts
        Object.keys(chartMargins).forEach(key => chartMargins[key] = Math.min(containerWidth, containerHeight) * 0.15);
    }

    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(chartAreaWidth, chartAreaHeight) / 2;
    
    if (radius <= 0) {
        console.warn("Calculated radius is zero or negative. Check container dimensions and margins.");
        svgRoot.append("text").attr("x", containerWidth / 2).attr("y", containerHeight / 2)
            .attr("text-anchor", "middle").text("Chart dimensions too small.").style("fill", "red").attr("class", "text error-text");
        return svgRoot.node();
    }

    mainChartGroup.attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({
        ...d,
        [valueFieldName]: +d[valueFieldName]
    }));

    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    if (categories.length < 3) {
         console.warn("Radial charts are generally more effective with 3 or more categories. Current: " + categories.length);
    }

    const allValues = chartDataArray.map(d => d[valueFieldName]);
    const minValue = Math.min(0, d3.min(allValues) ?? 0);
    const maxValue = d3.max(allValues) ?? 0;
    
    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI]) // d3.lineRadial handles closure; use full 2*PI for point scale if start/end points are distinct categories
        .padding(0.5); // For scalePoint, padding distributes points; range should not exclude endpoint if distinct categories

    // Corrected angleScale for distinct points, ensuring last point doesn't overlap first visually if data implies closure
     const angleScaleCorrected = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI * (categories.length > 0 ? (categories.length -1) / categories.length : 1) ]);


    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue === minValue ? minValue + 1 : maxValue * 1.1])
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering
    const gridTicks = radiusScale.ticks(5).filter(tick => tick >= minValue);
    const outermostTickValue = gridTicks.length > 0 ? gridTicks[gridTicks.length - 1] : (radiusScale.domain()[1] > 0 ? radiusScale.domain()[1] : radius);


    mainChartGroup.selectAll(".grid-circle")
        .data(gridTicks)
        .enter().append("circle")
        .attr("class", "mark grid-circle")
        .attr("r", d => radiusScale(d))
        .style("fill", "none")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 0.5)
        .style("stroke-dasharray", "3,3");

    mainChartGroup.selectAll(".radial-axis-line")
        .data(categories)
        .enter().append("line")
        .attr("class", "axis radial-axis-line")
        .attr("y2", -radiusScale(outermostTickValue))
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 0.5)
        .attr("transform", d => `rotate(${angleScaleCorrected(d) * 180 / Math.PI - 90})`);

    const categoryLabelOffset = parseInt(fillStyle.typography.labelFontSize) * 0.5 + 10; // Dynamic offset
    mainChartGroup.selectAll(".category-label-text")
        .data(categories)
        .enter().append("text")
        .attr("class", "label category-label-text")
        .attr("x", d => (radius + categoryLabelOffset) * Math.cos(angleScaleCorrected(d) - Math.PI / 2))
        .attr("y", d => (radius + categoryLabelOffset) * Math.sin(angleScaleCorrected(d) - Math.PI / 2))
        .text(d => d)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.categoryLabelTextColor)
        .attr("text-anchor", d => {
            const effAngle = (angleScaleCorrected(d) - Math.PI / 2 + 4 * Math.PI) % (2 * Math.PI);
            if (effAngle < 0.01 * Math.PI || Math.abs(effAngle - Math.PI) < 0.01 * Math.PI) return "middle";
            return effAngle > Math.PI ? "end" : "start";
        })
        .attr("dominant-baseline", d => {
            const effAngle = (angleScaleCorrected(d) - Math.PI / 2 + 4 * Math.PI) % (2 * Math.PI);
            if (Math.abs(effAngle - Math.PI / 2) < 0.01 * Math.PI || Math.abs(effAngle - 1.5 * Math.PI) < 0.01 * Math.PI) return "middle";
            return (effAngle > Math.PI / 2 && effAngle < 1.5 * Math.PI) ? "hanging" : "alphabetic";
        });

    if (gridTicks.length > 1 || (gridTicks.length === 1 && gridTicks[0] !== 0)) {
        mainChartGroup.selectAll(".tick-label-text")
            .data(gridTicks.filter(d => d > minValue || gridTicks.length === 1 || d === 0))
            .enter().append("text")
            .attr("class", "label tick-label-text")
            .attr("x", 5)
            .attr("y", d => -radiusScale(d))
            .attr("dy", "-0.2em")
            .text(d => d)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${Math.max(10, parseInt(fillStyle.typography.labelFontSize) * 0.75)}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight === 'bold' && parseInt(fillStyle.typography.labelFontSize) >=16 ? 'normal' : fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.tickLabelTextColor)
            .attr("text-anchor", "start");
    }

    // Block 8: Main Data Visualization Rendering
    const lineData = categories.map(cat => {
        const point = chartDataArray.find(item => item[categoryFieldName] === cat);
        return point || { [categoryFieldName]: cat, [valueFieldName]: minValue };
    });

    const radialLineDrawer = d3.lineRadial()
        .angle(d => angleScaleCorrected(d[categoryFieldName]))
        .radius(d => radiusScale(d[valueFieldName]))
        .curve(d3.curveCatmullRomClosed.alpha(0.5));
    
    mainChartGroup.append("path")
        .datum(lineData)
        .attr("class", "mark data-line")
        .attr("d", radialLineDrawer)
        .style("fill", "none")
        .style("stroke", fillStyle.primaryColor)
        .style("stroke-width", 3);

    mainChartGroup.selectAll(".data-point-mark")
        .data(lineData.filter(d => d[valueFieldName] !== undefined && radiusScale(d[valueFieldName]) >= 0))
        .enter().append("circle")
        .attr("class", "mark data-point-mark")
        .attr("r", 5)
        .style("fill", fillStyle.primaryColor)
        .style("stroke", fillStyle.pointStrokeColor)
        .style("stroke-width", 2)
        .attr("cx", d => radiusScale(d[valueFieldName]) * Math.cos(angleScaleCorrected(d[categoryFieldName]) - Math.PI / 2))
        .attr("cy", d => radiusScale(d[valueFieldName]) * Math.sin(angleScaleCorrected(d[categoryFieldName]) - Math.PI / 2));

    // Block 9: Optional Enhancements & Post-Processing (Value Labels)
    const valueLabelBgPadding = { x: 4, y: 2 };
    const baseRadialOffsetForValueLabel = 30; // Original effective offset

    lineData.filter(d => d[valueFieldName] !== undefined).forEach((d, index) => {
        const category = d[categoryFieldName];
        const value = d[valueFieldName];
        
        let currentRadialOffset = baseRadialOffsetForValueLabel;
        let xShiftForValueLabel = 0;

        // Special adjustment for the first category's label (top one) as per original logic
        if (index === 0 && categories.length > 1) {
            currentRadialOffset = baseRadialOffsetForValueLabel / 2; // Original was 15 vs 30
            xShiftForValueLabel = -20; // Original shifted X by -20
        }
        
        const pointAngleForLabel = angleScaleCorrected(category) - Math.PI / 2; // Angle for positioning (0 is UP)
        const pointRadiusForLabel = radiusScale(value);

        const labelText = value.toString();
        const textMetrics = {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        };
        const textWidth = estimateTextWidth(labelText, textMetrics.fontFamily, textMetrics.fontSize, textMetrics.fontWeight);
        const textHeight = parseInt(textMetrics.fontSize);

        const labelX = (pointRadiusForLabel + currentRadialOffset) * Math.cos(pointAngleForLabel) + xShiftForValueLabel;
        const labelY = (pointRadiusForLabel + currentRadialOffset) * Math.sin(pointAngleForLabel);
        
        mainChartGroup.append("rect")
            .attr("class", "label value-label-background")
            .attr("x", labelX - textWidth / 2 - valueLabelBgPadding.x)
            .attr("y", labelY - textHeight / 2 - valueLabelBgPadding.y)
            .attr("width", textWidth + 2 * valueLabelBgPadding.x)
            .attr("height", textHeight + 2 * valueLabelBgPadding.y)
            .style("fill", fillStyle.valueLabelBackgroundColor)
            .attr("rx", 3).attr("ry", 3);

        mainChartGroup.append("text")
            .attr("class", "text value-label-text")
            .attr("x", labelX)
            .attr("y", labelY)
            .text(labelText)
            .style("font-family", textMetrics.fontFamily)
            .style("font-size", textMetrics.fontSize)
            .style("font-weight", textMetrics.fontWeight)
            .style("fill", fillStyle.valueLabelTextColor)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central");
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
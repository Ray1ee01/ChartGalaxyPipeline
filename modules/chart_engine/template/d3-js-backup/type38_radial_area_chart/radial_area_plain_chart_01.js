/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Area Chart",
  "chart_name": "radial_area_plain_chart_01",
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
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const rawColors = data.colors || {}; // Assuming light theme, or logic to pick dark if specified
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missing = [];
        if (!categoryFieldName) missing.push("categoryField (role 'x')");
        if (!valueFieldName) missing.push("valueField (role 'y')");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')} not found in dataColumns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; padding: 10px;'>Error: Critical chart configuration missing. ${missing.join(' and ')} must be defined in data columns.</div>`);
        }
        return null;
    }
    
    if (chartDataArray.length === 0) {
        console.warn("Chart data is empty. Rendering an empty chart area.");
        // Optionally, render a message in the container or return early
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: rawColors.other?.primary || '#1f77b4',
        textColor: rawColors.text_color || '#333333',
        axisColor: '#BBBBBB', // Default, as not in color spec, consider adding to 'other' if needed
        chartBackground: rawColors.background_color || '#FFFFFF',
        valueLabelBackgroundColor: rawColors.other?.primary || '#1f77b4', // Same as primary for consistency
        valueLabelTextColor: '#FFFFFF', // Assumed contrast with primaryColor background
        areaOpacity: 0.2, 
        areaStrokeWidth: 6, 
        pointRadius: 6, 
        pointStrokeWidth: 3, 
    };

    fillStyle.typography = {
        labelFontFamily: typography.label?.font_family || 'Arial, sans-serif',
        labelFontSize: typography.label?.font_size || '16px', // For category labels (original: 16px)
        labelFontWeight: typography.label?.font_weight || 'bold',
        
        annotationFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
        annotationFontSize: typography.annotation?.font_size || '14px', // For value labels (original: 14px)
        annotationFontWeight: typography.annotation?.font_weight || 'normal',
    };

    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        if (!text) return 0;
        const size = parseFloat(fontSize);
        if (isNaN(size) || size <= 0) {
            // console.warn("Invalid fontSize for estimateTextWidth:", fontSize);
            return text.length * 8; // Rough fallback
        }
        try {
            const svgNS = 'http://www.w3.org/2000/svg';
            const svgEl = document.createElementNS(svgNS, 'svg');
            const textEl = document.createElementNS(svgNS, 'text');
            textEl.setAttribute('font-family', fontFamily);
            textEl.setAttribute('font-size', fontSize);
            textEl.setAttribute('font-weight', fontWeight);
            textEl.textContent = text;
            svgEl.appendChild(textEl);
            // Do not append to DOM as per directive
            const width = textEl.getBBox().width;
            return width;
        } catch (e) {
            // console.warn("estimateTextWidth using getBBox failed, falling back to rough estimate:", e);
            return text.length * size * 0.6; // Rougher fallback
        }
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 50, bottom: 50, left: 50 }; 
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other") 
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    
    if (categories.length === 0 && chartDataArray.length > 0) {
         console.warn("Data provided, but no categories found using field:", categoryFieldName);
    }
    if (categories.length > 0 && categories.length < 3) { // Based on required_fields_range for x
        console.warn(`Radial chart ideally needs at least 3 categories, found ${categories.length}. Visualization might be suboptimal.`);
    }

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories.length > 0 ? categories : [""]) // Provide a default domain if categories is empty
        .range([0, 2 * Math.PI - (categories.length > 0 ? (2 * Math.PI / categories.length) : 0)]);

    const allValues = chartDataArray.map(d => parseFloat(d[valueFieldName])).filter(v => !isNaN(v));
    const minValue = allValues.length > 0 ? d3.min(allValues) : 0;
    const maxValue = allValues.length > 0 ? d3.max(allValues) : 0;
    
    const radiusScale = d3.scaleLinear()
        .domain([Math.min(0, minValue), Math.max(0.00001, maxValue) * 1.2]) // Ensure max is non-zero
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    if (categories.length > 0) {
        mainChartGroup.selectAll(".axis-radial")
            .data(categories)
            .enter()
            .append("line")
            .attr("class", "axis axis-radial")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", d => radius * Math.cos(angleScale(d) - Math.PI / 2))
            .attr("y2", d => radius * Math.sin(angleScale(d) - Math.PI / 2))
            .attr("stroke", fillStyle.axisColor)
            .attr("stroke-width", 1);

        mainChartGroup.selectAll(".label-category")
            .data(categories)
            .enter()
            .append("text")
            .attr("class", "label label-category text")
            .attr("x", d => (radius + 20) * Math.cos(angleScale(d) - Math.PI / 2)) // 20 is padding
            .attr("y", d => (radius + 20) * Math.sin(angleScale(d) - Math.PI / 2))
            .attr("text-anchor", d => {
                const originalAngle = angleScale(d); 
                if (Math.abs(originalAngle % Math.PI) < 0.01) return "middle"; 
                return (originalAngle > Math.PI && originalAngle < 2 * Math.PI) ? "end" : "start";
            })
            .attr("dominant-baseline", d => {
                const originalAngle = angleScale(d);
                if (Math.abs(originalAngle % Math.PI) < 0.01) return "middle";
                return originalAngle < Math.PI ? "hanging" : "auto"; 
            })
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(d => d);
    }

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    if (chartDataArray.length > 0 && categories.length > 0) {
        const pointsForArea = categories.map(cat => {
            const pointData = chartDataArray.find(item => item[categoryFieldName] === cat);
            const value = pointData ? parseFloat(pointData[valueFieldName]) : 0;
            const currentRadiusScaled = radiusScale(isNaN(value) ? 0 : value);
            const drawingAngle = angleScale(cat) - Math.PI / 2; 
            return [currentRadiusScaled * Math.cos(drawingAngle), currentRadiusScaled * Math.sin(drawingAngle)];
        });

        if (pointsForArea.length > 0) {
            mainChartGroup.append("path")
                .attr("class", "mark area-mark")
                .attr("d", d3.line()(pointsForArea) + "Z") 
                .attr("fill", fillStyle.primaryColor)
                .attr("fill-opacity", fillStyle.areaOpacity)
                .attr("stroke", fillStyle.primaryColor)
                .attr("stroke-width", fillStyle.areaStrokeWidth)
                .attr("stroke-linejoin", "miter");
        }

        categories.forEach((cat) => {
            const pointData = chartDataArray.find(item => item[categoryFieldName] === cat);
            if (pointData) {
                const value = parseFloat(pointData[valueFieldName]);
                if (isNaN(value)) return; 

                const drawingAngle = angleScale(cat) - Math.PI / 2;
                const currentRadiusScaled = radiusScale(value);
                
                const cx = currentRadiusScaled * Math.cos(drawingAngle);
                const cy = currentRadiusScaled * Math.sin(drawingAngle);

                mainChartGroup.append("circle")
                    .attr("class", "mark mark-point")
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", fillStyle.pointRadius)
                    .attr("fill", fillStyle.primaryColor)
                    .attr("stroke", fillStyle.chartBackground) 
                    .attr("stroke-width", fillStyle.pointStrokeWidth);

                const labelText = pointData[valueFieldName]?.toString() || "";
                const textWidth = estimateTextWidth(labelText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
                
                const labelOffset = 30; 
                const textX = (currentRadiusScaled + labelOffset) * Math.cos(drawingAngle);
                const textY = (currentRadiusScaled + labelOffset) * Math.sin(drawingAngle);
                
                const valueLabelFontSizePx = parseFloat(fillStyle.typography.annotationFontSize);
                const rectPadding = 4;
                const rectHeight = valueLabelFontSizePx + rectPadding * 2;
                const rectWidth = textWidth + rectPadding * 2;

                mainChartGroup.append("rect")
                    .attr("class", "other value-label-background")
                    .attr("x", textX - rectWidth / 2)
                    .attr("y", textY - rectHeight / 2)
                    .attr("width", rectWidth)
                    .attr("height", rectHeight)
                    .attr("fill", fillStyle.valueLabelBackgroundColor)
                    .attr("rx", 3); 

                mainChartGroup.append("text")
                    .attr("class", "value value-label text")
                    .attr("x", textX)
                    .attr("y", textY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .attr("fill", fillStyle.valueLabelTextColor)
                    .text(labelText);
            }
        });
    }

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
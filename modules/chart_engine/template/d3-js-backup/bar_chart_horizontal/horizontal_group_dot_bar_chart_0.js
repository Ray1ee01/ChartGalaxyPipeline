/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Icon Chart",
  "chart_name": "horizontal_grouped_icon_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 6], [0, "inf"], [2, 5]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
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
    const chartDataRaw = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed in data.colors_dark
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    let criticalFieldsMissing = [];
    if (!xField) criticalFieldsMissing.push("xField (role: 'x')");
    if (!yField) criticalFieldsMissing.push("yField (role: 'y')");
    if (!groupField) criticalFieldsMissing.push("groupField (role: 'group')");

    if (criticalFieldsMissing.length > 0) {
        const errorMsg = `Critical chart config missing: ${criticalFieldsMissing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }

    const xUnit = dataColumns.find(col => col.role === "x" && col.unit !== "none")?.unit || "";
    const yUnit = dataColumns.find(col => col.role === "y" && col.unit !== "none")?.unit || "";
    // const groupUnit = dataColumns.find(col => col.role === "group" && col.unit !== "none")?.unit || ""; // Not used in this chart

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) ? rawTypography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) ? rawTypography.title.font_size : '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) ? rawTypography.title.font_weight : 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#0f223b',
        chartBackground: rawColors.background_color || '#FFFFFF',
        primaryAccent: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#1f77b4',
        // secondaryAccent: (rawColors.other && rawColors.other.secondary) ? rawColors.other.secondary : '#ff7f0e', // Not used
        iconUrls: {}, // To be populated from images.field
    };

    if (images.field) {
        Object.keys(images.field).forEach(key => {
            fillStyle.iconUrls[key] = images.field[key];
        });
    }
    if (images.other && images.other.primary && !fillStyle.iconUrls.default) { // Example default icon
        // fillStyle.iconUrls.default = images.other.primary; // Not used in this chart logic
    }

    // Helper: In-memory text measurement
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Note: Appending to body and then removing is more reliable for getBBox, but strictly forbidden.
        // For simple cases, direct getBBox might work, or use a canvas-based approach if precision is paramount and DOM manipulation is truly off-limits.
        // However, the prompt implies an in-memory SVG structure is sufficient.
        // A common robust way without appending to DOM:
        // document.body.appendChild(svg); // Temporarily append
        // const width = textEl.getBBox().width;
        // document.body.removeChild(svg); // Clean up
        // return width;
        // Given the constraint "MUST NOT be appended to the document DOM", we rely on getBBox on an unattached element.
        // This might not be perfectly accurate across all browsers/setups for complex text, but adheres to the constraint.
        try {
            return textEl.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails on unattached element (e.g. Firefox)
            // Basic estimation: character count * (font size * factor)
            const avgCharWidthFactor = 0.6; // Rough estimate
            return text.length * (parseFloat(fontSize) * avgCharWidthFactor);
        }
    }
    
    // Helper: Value formatting
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Icon layout constants (from original, kept for visual consistency)
    const ICONS_PER_MAX_VALUE = 20; // How many icons represent the max value
    const ICON_GROUP_SIZE = 5;      // Number of icons before a larger gap
    const DEFAULT_ICON_SPACING = 5;
    const LARGER_GROUP_SPACING = 10;


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

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 50, left: 150 }; // Increased left margin for category labels
    
    // Calculate actual绘图区域大小
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartDataRaw.map(d => d[groupField])));

    const processedData = chartDataRaw.reduce((acc, d) => {
        const category = d[xField];
        const group = d[groupField];
        const value = +d[yField];

        if (category === undefined || group === undefined || isNaN(value)) {
            console.warn("Skipping data point with missing category, group, or invalid value:", d);
            return acc;
        }
        
        let existingCategory = acc.find(item => item.category === category);
        if (existingCategory) {
            existingCategory.groups[group] = value;
        } else {
            const newCategory = { category: category, groups: {} };
            newCategory.groups[group] = value;
            acc.push(newCategory);
        }
        return acc;
    }, []);

    if (processedData.length === 0 && chartDataRaw.length > 0) {
         const errorMsg = `No valid data to render after processing. Check data structure and field names. X: ${xField}, Y: ${yField}, Group: ${groupField}`;
        console.error(errorMsg);
        d3.select(containerSelector).select("svg").remove(); // remove svg if already added
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }
     if (processedData.length === 0 && chartDataRaw.length === 0) {
        d3.select(containerSelector).append("div")
            .style("padding", "10px")
            .html("No data provided.");
        return null;
    }


    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerHeight])
        .padding(0.2);

    const groupScale = d3.scaleBand()
        .domain(groups)
        .range([0, yScale.bandwidth()])
        .padding(0.05);

    const maxValue = d3.max(chartDataRaw, d => +d[yField]) || 1; // Ensure maxValue is at least 1 to avoid division by zero

    // X scale is implicit in the icon counting logic, not a typical D3 axis scale here.
    // The width of the icon display area is innerWidth.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Category labels (acting as Y-axis) are rendered in Block 8 with bar groups.
    // No X-axis or gridlines as per simplification.
    // No legend.

    // Block 8: Main Data Visualization Rendering
    const categoryGroups = mainChartGroup.selectAll(".category-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "mark category-group")
        .attr("transform", d => `translate(0, ${yScale(d.category)})`);

    categoryGroups.append("text")
        .attr("class", "label category-label")
        .attr("x", -10)
        .attr("y", yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d.category + (xUnit ? ` (${xUnit})` : ''));

    groups.forEach((groupName, groupIndex) => {
        categoryGroups.each(function(d_category) { // d_category is { category: "...", groups: { ... } }
            const categoryContainer = d3.select(this);
            const value = d_category.groups[groupName] || 0;
            const iconUrl = fillStyle.iconUrls[groupName];

            if (!iconUrl) {
                // console.warn(`No icon URL found for group: ${groupName}. Skipping icons for this group in category ${d_category.category}.`);
                // Optionally render a placeholder or text if icon is missing
                categoryContainer.append("text")
                    .attr("class", "label missing-icon-label")
                    .attr("x", 0)
                    .attr("y", groupScale(groupName) + groupScale.bandwidth() / 2)
                    .attr("dy", "0.35em")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("fill", fillStyle.textColor)
                    .text(`(Icon for '${groupName}' missing)`);
                // And render value label
                 categoryContainer.append("text")
                    .attr("class", "value data-label")
                    .attr("x", estimateTextWidth(`(Icon for '${groupName}' missing)`, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight) + 5)
                    .attr("y", groupScale(groupName) + groupScale.bandwidth() / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formatValue(value) + (yUnit ? ` ${yUnit}` : ''));
                return;
            }

            const rowY = groupScale(groupName);
            const rowHeight = groupScale.bandwidth();
            
            const numIconsExact = (value / maxValue) * ICONS_PER_MAX_VALUE;
            const numFullIcons = Math.floor(numIconsExact);
            const partialIconScale = numIconsExact - numFullIcons;

            const iconHeight = rowHeight * 0.8;
            const iconWidth = iconHeight; // Assuming square icons
            const iconY = rowY + (rowHeight - iconHeight) / 2;
            const iconSpacing = Math.min(DEFAULT_ICON_SPACING, iconWidth * 0.2);

            let currentX = 0;
            for (let i = 0; i < numFullIcons; i++) {
                if (i > 0 && i % ICON_GROUP_SIZE === 0) {
                    currentX += LARGER_GROUP_SPACING;
                }
                categoryContainer.append("image")
                    .attr("class", "image icon-mark")
                    .attr("x", currentX)
                    .attr("y", iconY)
                    .attr("width", iconWidth)
                    .attr("height", iconHeight)
                    .attr("xlink:href", iconUrl);
                currentX += iconWidth + iconSpacing;
            }

            if (partialIconScale > 0 && numFullIcons < ICONS_PER_MAX_VALUE) { // Ensure not to draw partial if already at max full icons
                if (numFullIcons > 0 && numFullIcons % ICON_GROUP_SIZE === 0) {
                     currentX += LARGER_GROUP_SPACING; // Add group spacing if partial icon starts a new group
                }
                const clipId = `clip-${d_category.category.replace(/[^a-zA-Z0-9]/g, "")}-${groupName.replace(/[^a-zA-Z0-9]/g, "")}-${groupIndex}`;
                
                defs.append("clipPath")
                    .attr("id", clipId)
                    .append("rect")
                    .attr("x", 0) // Clip path is relative to the image it's applied to if not using userSpaceOnUse
                    .attr("y", 0)
                    .attr("width", iconWidth * partialIconScale)
                    .attr("height", iconHeight);

                categoryContainer.append("image")
                    .attr("class", "image icon-mark partial-icon")
                    .attr("x", currentX)
                    .attr("y", iconY)
                    .attr("width", iconWidth)
                    .attr("height", iconHeight)
                    .attr("xlink:href", iconUrl)
                    .attr("clip-path", `url(#${clipId})`);
                currentX += iconWidth * partialIconScale;
            } else if (numFullIcons > 0) {
                 // If only full icons, currentX is at the end of the last full icon's spacing.
                 // Remove the last spacing to position label right after the icon.
                 currentX -= iconSpacing;
            }


            // Add value label
            categoryContainer.append("text")
                .attr("class", "value data-label")
                .attr("x", currentX + (numIconsExact > 0 ? 5 : 0)) // Add small padding if there are icons
                .attr("y", iconY + iconHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formatValue(value) + (yUnit ? ` ${yUnit}` : ''));
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements)
    // No additional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Treemap",
  "chart_name": "treemap_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The REQUIREMENTS_BEGIN...REQUIREMENTS_END block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data?.data;
    const variables = data.variables || {};
    const typographyUserConfig = data.typography || {};
    const colorsUserConfig = data.colors || {};
    // const imagesUserConfig = data.images || {}; // Not used in this treemap
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container immediately

    const categoryFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");

    let criticalError = false;
    const errorMessages = [];

    if (!categoryFieldConfig?.name) {
        errorMessages.push("Category field (role 'x') definition missing in data.data.columns.");
        criticalError = true;
    }
    if (!valueFieldConfig?.name) {
        errorMessages.push("Value field (role 'y') definition missing in data.data.columns.");
        criticalError = true;
    }
    if (!chartDataArray) {
        errorMessages.push("Chart data (data.data.data) is missing.");
        criticalError = true;
    } else if (chartDataArray.length === 0 && !criticalError) { // Non-critical if other errors already exist
         // This is a warning rather than a critical error if fields are defined
        console.warn("Chart data is empty. Rendering an empty chart area.");
        // Allow empty chart to render if config is otherwise valid
    }


    if (criticalError) {
        const errorMsgStr = `Critical chart configuration errors: ${errorMessages.join('; ')}. Cannot render.`;
        console.error(errorMsgStr);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsgStr.replace(/\n/g, "<br>"));
        return null;
    }
    
    const categoryFieldName = categoryFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyUserConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyUserConfig.label?.font_size || '12px',
            labelFontWeight: typographyUserConfig.label?.font_weight || 'bold',
            annotationFontFamily: typographyUserConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyUserConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyUserConfig.annotation?.font_weight || 'normal',
        },
        textOnMarkColor: colorsUserConfig.other?.text_on_mark || '#FFFFFF',
        cellStrokeColor: colorsUserConfig.other?.cell_stroke || '#FFFFFF',
        chartBackground: colorsUserConfig.background_color || '#FFFFFF',
        getCategoryColor: (categoryName, index) => {
            if (colorsUserConfig.field && colorsUserConfig.field[categoryName]) {
                return colorsUserConfig.field[categoryName];
            }
            if (colorsUserConfig.available_colors && colorsUserConfig.available_colors.length > 0) {
                return colorsUserConfig.available_colors[index % colorsUserConfig.available_colors.length];
            }
            return d3.schemeCategory10[index % 10];
        }
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.family);
        textElement.setAttribute('font-size', fontProps.size);
        textElement.setAttribute('font-weight', fontProps.weight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // getBBox is expected to work on non-DOM-attached SVG elements in modern browsers.
        return textElement.getBBox().width;
    }
    
    const cellPadding = typeof variables.cellPadding === 'number' ? variables.cellPadding : 3;
    const cellTextPadding = typeof variables.cellTextPadding === 'number' ? variables.cellTextPadding : 4;
    const valueFormatSpecifier = variables.valueFormat || ",.0f";
    const d3ValueFormatter = d3.format(valueFormatSpecifier);
    const interLineSpacing = 5; // px, space between category and value labels

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root treemap-chart");

    const chartMargins = {
        top: typeof variables.marginTop === 'number' ? variables.marginTop : 10,
        right: typeof variables.marginRight === 'number' ? variables.marginRight : 10,
        bottom: typeof variables.marginBottom === 'number' ? variables.marginBottom : 10,
        left: typeof variables.marginLeft === 'number' ? variables.marginLeft : 10
    };
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = Math.max(0, containerWidth - chartMargins.left - chartMargins.right);
    const innerHeight = Math.max(0, containerHeight - chartMargins.top - chartMargins.bottom);

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    let hierarchyDataRoot;
    if (chartDataArray.length === 0) {
        hierarchyDataRoot = { name: "root", children: [] }; // Empty data for treemap
    } else {
        const groupedChartData = d3.rollup(chartDataArray, 
            v => d3.sum(v, d => parseFloat(d[valueFieldName]) || 0), 
            d => d[categoryFieldName]
        );
        hierarchyDataRoot = {
            name: "root",
            children: Array.from(groupedChartData, ([name, value]) => ({ name, value }))
        };
    }
    
    const categoryOrderMap = new Map();
    if (hierarchyDataRoot.children) {
        hierarchyDataRoot.children.forEach((child, idx) => {
            categoryOrderMap.set(child.name, idx);
        });
    }

    const rootNode = d3.hierarchy(hierarchyDataRoot)
        .sum(d => d.value) // d.value is already summed in rollup
        .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Block 6: Scale Definition & Configuration
    const treemapLayout = d3.treemap()
        .size([innerWidth, innerHeight])
        .padding(cellPadding)
        .round(true);
    
    treemapLayout(rootNode);

    // Block 7: Chart Component Rendering
    // No axes, gridlines, or legend for this treemap.

    // Block 8: Main Data Visualization Rendering
    const leafGroups = mainChartGroup.selectAll("g.leaf-group")
        .data(rootNode.leaves())
        .join("g")
        .attr("class", "mark leaf-group")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leafGroups.append("rect")
        .attr("class", "value treemap-cell")
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("fill", d => fillStyle.getCategoryColor(d.data.name, categoryOrderMap.get(d.data.name)))
        .attr("stroke", fillStyle.cellStrokeColor)
        .attr("stroke-width", 1);

    leafGroups.append("title")
        .text(d => `${d.data.name}: ${d3ValueFormatter(d.value)}`);

    const categoryLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const valueLabelFontSize = parseFloat(fillStyle.typography.annotationFontSize);

    leafGroups.append("text")
        .attr("class", "label category-label")
        .attr("x", cellTextPadding)
        .attr("y", cellTextPadding)
        .attr("dominant-baseline", "hanging")
        .attr("fill", fillStyle.textOnMarkColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .each(function(d) {
            const textElement = d3.select(this);
            const originalText = String(d.data.name);
            textElement.text(originalText);
            
            const rectWidth = d.x1 - d.x0;
            const rectHeight = d.y1 - d.y0;
            const availableTextWidth = rectWidth - (2 * cellTextPadding);
            
            const fontProps = { 
                family: fillStyle.typography.labelFontFamily, 
                size: fillStyle.typography.labelFontSize, 
                weight: fillStyle.typography.labelFontWeight 
            };
            let textWidth = estimateTextWidth(originalText, fontProps);

            if (textWidth > availableTextWidth) {
                let fitText = originalText;
                while (estimateTextWidth(fitText + "...", fontProps) > availableTextWidth && fitText.length > 0) {
                    fitText = fitText.slice(0, -1);
                }
                if (fitText.length > 0) {
                    textElement.text(fitText + "...");
                } else if (estimateTextWidth("...", fontProps) <= availableTextWidth) {
                    textElement.text("...");
                } else {
                    textElement.text("");
                }
            }
            if (rectHeight < (categoryLabelFontSize + 2 * cellTextPadding)) {
                textElement.style("display", "none");
            }
        });

    leafGroups.append("text")
        .attr("class", "label value-label")
        .attr("x", cellTextPadding)
        .attr("y", cellTextPadding + categoryLabelFontSize + interLineSpacing)
        .attr("dominant-baseline", "hanging")
        .attr("fill", fillStyle.textOnMarkColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => d3ValueFormatter(d.value))
        .each(function(d) {
            const textElement = d3.select(this);
            const rectWidth = d.x1 - d.x0;
            const rectHeight = d.y1 - d.y0;
            const availableTextWidth = rectWidth - (2 * cellTextPadding);

            const fontProps = { 
                family: fillStyle.typography.annotationFontFamily, 
                size: fillStyle.typography.annotationFontSize, 
                weight: fillStyle.typography.annotationFontWeight 
            };
            const textWidth = estimateTextWidth(textElement.text(), fontProps);
            
            const requiredHeightForValueLabel = cellTextPadding + categoryLabelFontSize + interLineSpacing + valueLabelFontSize + cellTextPadding;

            if (textWidth > availableTextWidth || rectHeight < requiredHeightForValueLabel) {
                textElement.style("display", "none");
            }
        });

    // Block 9: Optional Enhancements & Post-Processing
    // Tooltips are added above. No other enhancements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
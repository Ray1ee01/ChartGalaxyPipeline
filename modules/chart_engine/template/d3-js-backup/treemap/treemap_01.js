/* REQUIREMENTS_BEGIN
{
  "chart_type": "Treemap",
  "chart_name": "treemap_01",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data?.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    // const imagesInput = data.images || {}; // Not used in this chart, but extracted per spec if needed
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldRole = "x";
    const valueFieldRole = "y";

    const categoryColumn = dataColumns.find(col => col.role === categoryFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);

    let missingConfigs = [];
    if (!categoryColumn || !categoryColumn.name) {
        missingConfigs.push(`category field (role: ${categoryFieldRole})`);
    }
    if (!valueColumn || !valueColumn.name) {
        missingConfigs.push(`value field (role: ${valueFieldRole})`);
    }
    if (!chartDataArray || chartDataArray.length === 0) {
        missingConfigs.push("chart data");
    }

    if (missingConfigs.length > 0) {
        const errorMsg = `Critical chart config missing: [${missingConfigs.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "bold" }, // For category labels (bold per original)
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" } // For value labels
    };

    const fillStyle = {
        typography: {
            labelFontFamily: typographyInput.label?.font_family || defaultTypography.label.font_family,
            labelFontSize: typographyInput.label?.font_size || defaultTypography.label.font_size,
            labelFontWeight: typographyInput.label?.font_weight || defaultTypography.label.font_weight,
            annotationFontFamily: typographyInput.annotation?.font_family || defaultTypography.annotation.font_family,
            annotationFontSize: typographyInput.annotation?.font_size || defaultTypography.annotation.font_size,
            annotationFontWeight: typographyInput.annotation?.font_weight || defaultTypography.annotation.font_weight,
        },
        textOnCellColor: colorsInput.text_on_cell_color || "#FFFFFF", // Specific for text on colored cells
        cellStrokeColor: colorsInput.other?.stroke_color || "#FFFFFF",
        chartBackground: colorsInput.background_color || "#FFFFFF",
        categoryColors: {
            field: colorsInput.field || {},
            available_colors: colorsInput.available_colors || []
        }
    };
    
    const categoryFontProps = {
        font_family: fillStyle.typography.labelFontFamily,
        font_size: fillStyle.typography.labelFontSize,
        font_weight: fillStyle.typography.labelFontWeight
    };
    const valueFontProps = {
        font_family: fillStyle.typography.annotationFontFamily,
        font_size: fillStyle.typography.annotationFontSize,
        font_weight: fillStyle.typography.annotationFontWeight
    };

    function estimateTextWidth(text, fontProps) {
        if (!text || text.length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family);
        tempText.setAttribute('font-size', fontProps.font_size);
        tempText.setAttribute('font-weight', fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("getBBox on unattached element failed, using approximate text width.", e);
            const fontSize = parseFloat(fontProps.font_size) || 12;
            width = text.length * fontSize * 0.6; 
        }
        return width;
    }

    const uniqueCategoriesList = Array.from(new Set(chartDataArray.map(d => d[categoryFieldName]))).sort();

    fillStyle.getCellColor = (categoryName) => {
        if (fillStyle.categoryColors.field && fillStyle.categoryColors.field[categoryName]) {
            return fillStyle.categoryColors.field[categoryName];
        }
        
        const categoryIndex = uniqueCategoriesList.indexOf(categoryName);
        if (categoryIndex === -1) { 
            return "#CCCCCC"; 
        }

        if (fillStyle.categoryColors.available_colors && fillStyle.categoryColors.available_colors.length > 0) {
            return fillStyle.categoryColors.available_colors[categoryIndex % fillStyle.categoryColors.available_colors.length];
        }
        return d3.schemeCategory10[categoryIndex % d3.schemeCategory10.length];
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "treemap-chart-svg")
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 };

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const valueFormatter = d3.format(",d");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const hierarchyInputData = { name: "root", children: [] };
    const groupedData = d3.group(chartDataArray, d => d[categoryFieldName]);
    
    groupedData.forEach((values, category) => {
        const totalValue = d3.sum(values, d => parseFloat(d[valueFieldName]) || 0);
        if (totalValue > 0) {
             hierarchyInputData.children.push({ name: category, value: totalValue });
        }
    });
    
    if (hierarchyInputData.children.length === 0) {
        const errorMsg = "No valid data to display in treemap (all categories have zero or negative sum, or data is malformed).";
        console.warn(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    const hierarchyRoot = d3.hierarchy(hierarchyInputData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value); 

    // Block 6: Scale Definition & Configuration
    // fillStyle.getCellColor is defined in Block 2.

    const treemapLayout = d3.treemap()
        .size([innerWidth, innerHeight])
        .padding(3) 
        .round(true);

    const rootNode = treemapLayout(hierarchyRoot);

    // Block 7: Chart Component Rendering
    // Not applicable for treemap.

    // Block 8: Main Data Visualization Rendering
    const leafGroups = mainChartGroup.selectAll("g.leaf-group")
        .data(rootNode.leaves())
        .join("g")
        .attr("class", "leaf-group mark")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leafGroups.append("rect")
        .attr("class", "treemap-cell value") // 'value' class for the visual mark representing data
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("fill", d => fillStyle.getCellColor(d.data.name))
        .attr("stroke", fillStyle.cellStrokeColor);

    leafGroups.append("title")
        .text(d => `${d.data.name}: ${valueFormatter(d.value)}`);

    const categoryLabelY = (parseFloat(categoryFontProps.font_size) || 12) + 2;
    const valueLabelY = categoryLabelY + (parseFloat(valueFontProps.font_size) || 10) + 4;
    const minHeightForOneLine = (parseFloat(categoryFontProps.font_size) || 12) + 6; // font + padding
    const minHeightForTwoLines = valueLabelY + 2; // y pos of value + padding

    leafGroups.append("text")
        .attr("class", "label category-label")
        .attr("x", 4) 
        .attr("y", categoryLabelY)
        .attr("fill", fillStyle.textOnCellColor)
        .style("font-family", categoryFontProps.font_family)
        .style("font-size", categoryFontProps.font_size)
        .style("font-weight", categoryFontProps.font_weight)
        .each(function(d) {
            const node = d3.select(this);
            let textContent = d.data.name; 
            const rectWidth = d.x1 - d.x0;
            const rectHeight = d.y1 - d.y0;
            const hPadding = 8; 

            if (rectHeight < minHeightForOneLine) {
                 node.text(""); return;
            }

            node.text(textContent); 
            let currentTextWidth = estimateTextWidth(textContent, categoryFontProps);

            if (currentTextWidth > rectWidth - hPadding) {
                while (textContent.length > 0) {
                    textContent = textContent.slice(0, -1);
                    const newWidth = estimateTextWidth(textContent + "...", categoryFontProps);
                    if (newWidth <= rectWidth - hPadding) {
                        node.text(textContent + "...");
                        break;
                    }
                }
                if (textContent.length === 0 && estimateTextWidth("...", categoryFontProps) > rectWidth - hPadding) {
                     node.text("");
                } else if (textContent.length === 0) {
                    node.text("..."); // If only "..." fits
                }
            }
        });

    leafGroups.append("text")
        .attr("class", "value data-value-label")
        .attr("x", 4) 
        .attr("y", valueLabelY) 
        .attr("fill", fillStyle.textOnCellColor)
        .style("font-family", valueFontProps.font_family)
        .style("font-size", valueFontProps.font_size)
        .style("font-weight", valueFontProps.font_weight)
        .text(d => valueFormatter(d.value))
        .each(function(d) {
            const node = d3.select(this);
            const textContent = valueFormatter(d.value);
            const rectWidth = d.x1 - d.x0;
            const rectHeight = d.y1 - d.y0;
            const hPadding = 8;
            
            const valueTextWidth = estimateTextWidth(textContent, valueFontProps);

            if (valueTextWidth > rectWidth - hPadding || rectHeight < minHeightForTwoLines) {
                node.style("display", "none");
            }
        });

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
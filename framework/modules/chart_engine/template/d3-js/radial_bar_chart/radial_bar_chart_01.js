/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Radial Bar Chart",
    "chart_name": "radial_bar_chart_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 20], [0, 100]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary", "secondary", "background"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 600,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    
    // Clear container
    d3.select(containerSelector).html("");
    
    // Get field names
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    
    // 按yField降序排序数据
    chartData.sort((a, b) => b[yField] - a[yField]);
    
    // Set dimensions and margins
    const width = variables.width*2;
    const height = variables.height*2;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // Calculate center point and max radius
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(chartWidth, chartHeight) / 2;
    
    // Create a root group
    const g = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);
    
    return svg.node();
}
/*
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Custom Bar Chart",
    "chart_name": "custom_bar_chart_01",
    "required_fields": ["Country", "Score", "Retailer Type"],
    "required_fields_type": ["string", "number", "string"],
    "required_data_points": [5, 100],
    "width": [500, 1000],
    "height": [300, 800]
}
REQUIREMENTS_END
*/
function make_option(jsonData) {
    // Validate input
    if (!jsonData || !jsonData.data || !jsonData.variables) {
        console.error("Error: Invalid JSON data structure");
        return {
            title: {
                text: "Error: Invalid JSON data structure",
                left: 'center'
            }
        };
    }
    
    try {
        const data = jsonData.data;
        const variables = jsonData.variables;
        
        // Extract field names from variables
        const xField = variables.x_axis.field;
        const yField = variables.y_axis.field;
        const colorField = variables.color.mark_color.field;
        
        // Get color range from input
        const colorDomain = variables.color.mark_color.domain || [];
        const colorRange = variables.color.mark_color.range || [];
        
        // Color mapping function
        const getColor = (category) => {
            const index = colorDomain.indexOf(category);
            return index >= 0 ? colorRange[index] : '#d10000'; // Default to red if not found
        };
        
        // Group data by x-axis field (e.g., Country)
        const categories = [...new Set(data.map(item => item[xField]))];
        
        // Get all unique retailer types
        const retailerTypes = colorDomain.length > 0 ? colorDomain : 
            [...new Set(data.map(item => item[colorField]))];
        
        // Transform data for ECharts series
        const seriesData = {};
        retailerTypes.forEach(type => {
            seriesData[type] = [];
        });
        
        // For each category and retailer type, find the corresponding value
        categories.forEach(category => {
            // Find all data points for this category
            const categoryData = data.filter(item => item[xField] === category);
            
            // For each retailer type, find the corresponding value or use 0
            retailerTypes.forEach(retailerType => {
                const dataItem = categoryData.find(item => item[colorField] === retailerType);
                const value = dataItem ? dataItem[yField] : 0;
                seriesData[retailerType].push(value);
            });
        });
        
        // Chart configuration based on json data
        const chartHeight = variables.height || 600;
        const chartWidth = variables.width || 800;
        const textColor = variables.color.text_color || '#333';
        
        // Create series array for ECharts
        const series = retailerTypes.map(type => {
            return {
                name: type,
                type: 'bar',
                stack: 'total',
                emphasis: {
                    focus: 'series'
                },
                label: {
                    show: true,
                    position: 'inside',
                    formatter: '{c}',
                    color: '#fff',
                    fontSize: 12
                },
                itemStyle: {
                    color: getColor(type),
                    borderRadius: variables.mark && variables.mark.has_rounded_corners ? [0, 0, 3, 3] : 0,
                    shadowBlur: variables.mark && variables.mark.has_shadow ? 5 : 0,
                    shadowColor: 'rgba(0, 0, 0, 0.3)',
                    borderWidth: variables.mark && variables.mark.has_stroke ? 1 : 0,
                    borderColor: variables.color.stroke_color || '#fff'
                },
                data: seriesData[type]
            };
        });
        
        // Return ECharts option object
        return {
            backgroundColor: '#ffffff',
            title: {
                text: 'Distribution by Retailer Type',
                subtext: 'Data grouped by country',
                left: 'center',
                textStyle: {
                    color: textColor,
                    fontFamily: jsonData.typography?.title?.font_family || 'Arial',
                    fontSize: parseInt(jsonData.typography?.title?.font_size) || 18,
                    fontWeight: jsonData.typography?.title?.font_weight || 'bold'
                },
                subtextStyle: {
                    color: textColor,
                    fontFamily: jsonData.typography?.subtitle?.font_family || 'Arial',
                    fontSize: parseInt(jsonData.typography?.subtitle?.font_size) || 14
                }
            },
            legend: {
                data: retailerTypes,
                top: '40px',
                textStyle: {
                    color: textColor,
                    fontSize: 12
                },
                icon: 'roundRect'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '100px',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: categories,
                axisLine: {
                    lineStyle: { color: textColor }
                },
                axisLabel: {
                    color: textColor,
                    fontSize: 12,
                    interval: 0,
                    rotate: categories.length > 5 ? 45 : 0 // Rotate labels if too many categories
                }
            },
            yAxis: {
                type: 'value',
                name: yField,
                nameTextStyle: {
                    color: textColor,
                    fontSize: 12,
                    padding: [0, 0, 0, 40]
                },
                axisLine: {
                    show: true,
                    lineStyle: { color: textColor }
                },
                axisLabel: {
                    color: textColor,
                    fontSize: 12
                },
                splitLine: {
                    lineStyle: { color: '#eee' }
                }
            },
            series: series
        };
    } catch (error) {
        console.error("Error in make_option:", error);
        return {
            title: {
                text: "Error: " + error.message,
                left: 'center'
            }
        };
    }
} 
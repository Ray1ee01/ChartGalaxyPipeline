/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Stacked Bar Chart",
    "chart_name": "echarts_stacked_bar_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 10], [0, 100], [2, 8]],
    "required_fields_icons": ["x"],
    "required_other_icons": ["primary"],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner"],
    "min_height": 400,
    "min_width": 500,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
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
        const data = jsonData.data.data;
        const variables = jsonData.variables;
        const typography = jsonData.typography || {};
        const colors = jsonData.colors || {};
        const images = jsonData.images || { field: {}, other: {} };
        const dataColumns = jsonData.data.columns || [];
        
        // Extract field names from data_columns
        const xField = dataColumns[0].name;
        const yField = dataColumns[1].name;
        const colorField = dataColumns[2].name;
        
        // Color mapping function using the colors from json_data
        const getColor = (category) => {
            return colors.field && colors.field[category] ? colors.field[category] : colors.other.primary;
        };
        
        // Group data by x-axis field (e.g., Country)
        const categories = [...new Set(data.map(item => item[xField]))];
        
        // Get all unique group values
        const groupValues = [...new Set(data.map(item => item[colorField]))];
        
        // Transform data for ECharts series
        const seriesData = {};
        groupValues.forEach(type => {
            seriesData[type] = [];
        });
        
        // For each category and group value, find the corresponding value
        categories.forEach(category => {
            // Find all data points for this category
            const categoryData = data.filter(item => item[xField] === category);
            
            // For each group value, find the corresponding value or use 0
            groupValues.forEach(groupValue => {
                const dataItem = categoryData.find(item => item[colorField] === groupValue);
                const value = dataItem ? dataItem[yField] : 0;
                seriesData[groupValue].push(value);
            });
        });
        
        // Chart configuration based on json data
        const chartHeight = variables.height || 600;
        const chartWidth = variables.width || 800;
        const textColor = colors.text_color || '#333';
        
        // Create series array for ECharts
        const series = groupValues.map(type => {
            return {
                name: type,
                type: 'bar',
                stack: 'total',
                emphasis: {
                    focus: 'series',
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                },
                label: {
                    show: true,
                    position: 'inside',
                    formatter: '{c}',
                    color: '#fff',
                    fontSize: parseInt(typography.label?.font_size) || 12,
                    fontFamily: typography.label?.font_family || 'Arial'
                },
                itemStyle: {
                    color: getColor(type),
                    borderRadius: variables.has_rounded_corners ? [0, 0, 3, 3] : 0,
                    shadowBlur: variables.has_shadow ? 5 : 0,
                    shadowColor: 'rgba(0, 0, 0, 0.3)',
                    borderWidth: variables.has_stroke ? 1 : 0,
                    borderColor: colors.stroke_color || '#fff'
                },
                data: seriesData[type]
            };
        });
        
        // Create x-axis labels with icons if available
        const xAxisLabels = categories.map(category => {
            if (images.field && images.field[category]) {
                return {
                    value: category,
                    textStyle: {
                        rich: {
                            img: {
                                height: 20,
                                align: 'center'
                            }
                        }
                    }
                };
            }
            return category;
        });
        
        // Return ECharts option object
        return {
            backgroundColor: 'none',
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            legend: {
                data: groupValues,
                top: '40px',
                textStyle: {
                    color: textColor,
                    fontSize: parseInt(typography.label?.font_size) || 12,
                    fontFamily: typography.label?.font_family || 'Arial'
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
                    fontSize: parseInt(typography.label?.font_size) || 12,
                    fontFamily: typography.label?.font_family || 'Arial',
                    interval: 0,
                    rotate: categories.length > 5 ? 30 : 0, // Rotate labels if too many categories
                    formatter: function(value) {
                        // Check if we have an icon for this category
                        if (images.field && images.field[value]) {
                            // Return formatted label with icon
                            return `{img|}\n${value}`;
                        }
                        return value;
                    },
                    rich: {
                        img: {
                            height: 20,
                            align: 'center'
                        }
                    }
                }
            },
            yAxis: {
                type: 'value',
                name: yField,
                nameTextStyle: {
                    color: textColor,
                    fontSize: parseInt(typography.label?.font_size) || 12,
                    fontFamily: typography.label?.font_family || 'Arial',
                    padding: [0, 0, 0, 40]
                },
                axisLine: {
                    show: true,
                    lineStyle: { color: textColor }
                },
                axisLabel: {
                    color: textColor,
                    fontSize: parseInt(typography.label?.font_size) || 12,
                    fontFamily: typography.label?.font_family || 'Arial'
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
'''
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Multiple Bar Chart",
    "chart_name": "simple_multiple_bar_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": ["string", "number", "string"],
    "required_fields_": ["string", "0-1", "string"],
    "required_data_points": [5, 100],
    "x_values": [2, 10],
    "group_values": [2, 8],
    "width": [500, 1000],
    "height": [300, 600]
}
REQUIREMENTS_END
'''
def get_grid_layout(num_items):
    """
    Calculate the optimal grid layout (rows and columns) for a given number of items
    
    Args:
        num_items: Number of items to arrange in a grid
        
    Returns:
        Tuple containing (rows, columns)
    """
    if num_items <= 0:
        return (0, 0)
    elif num_items == 1:
        return (1, 1)
    elif num_items == 2:
        return (1, 2)  # Two side by side
    elif num_items == 3 or num_items == 4:
        return (2, 2)  # 2x2 grid
    elif num_items <= 6:
        return (2, 3)  # 2x3 grid
    elif num_items <= 9:
        return (3, 3)  # 3x3 grid
    elif num_items <= 12:
        return (3, 4)  # 3x4 grid
    else:
        # Default to 4x4 grid for larger numbers
        return (4, 4)

def make_options(json_data):
    """
    Generate ECharts options for horizontal bar charts
    
    Args:
        json_data: Dictionary containing the JSON data from input.json
        
    Returns:
        ECharts options dictionary
    """
    # Extract relevant data from json_data
    data = json_data['data']
    variables = json_data['variables']
    constants = json_data['constants']
    
    # Extract fields directly
    x_field = variables['x_axis']['field']
    y_field = variables['y_axis']['field']
    group_field = variables['color']['mark_color']['field']
    
    # Get colors directly
    colors = variables['color']['mark_color']['range']
    
    # Get unique categories and groups
    categories = sorted(list(set(item[x_field] for item in data)))
    groups = sorted(list(set(item[group_field] for item in data)))
    
    # Create a color mapping for groups
    group_colors = {}
    for i, group in enumerate(groups):
        group_colors[group] = colors[i % len(colors)]
    
    # Define dimensions based on json_data
    canvas_width = variables['width']
    canvas_height = variables['height']
    title_height = 60
    legend_height = 40
    
    # Calculate grid layout
    num_charts = len(categories)
    rows, cols = get_grid_layout(num_charts)
    
    # Adjust margin based on number of columns
    chart_margin = 30
    
    options = {
        "title": [],
        "color": colors[:len(groups)],
        "legend": {
            "data": groups,
            "top": title_height,
            "orient": "horizontal",
            "align": "center",
            "left": "center"
        },
        "grid": [],
        "xAxis": [],
        "yAxis": [],
        "series": []
    }
    
    # Calculate chart dimensions
    content_top = title_height + legend_height
    content_height = canvas_height - content_top - chart_margin
    
    chart_width = (canvas_width - (chart_margin * (cols + 1))) / cols
    chart_height = (content_height - (chart_margin * (rows + 1))) / rows
    
    # Add each bar chart
    for i, category in enumerate(categories):
        if i >= rows * cols:  # Safety check
            break
            
        row = i // cols
        col = i % cols
        
        # Calculate grid positions as percentages
        left = (chart_margin + (col * (chart_width + chart_margin))) / canvas_width * 100
        top = (content_top + chart_margin + (row * (chart_height + chart_margin))) / canvas_height * 100
        width = chart_width / canvas_width * 100
        height = chart_height / canvas_height * 100
        
        # Add grid for this chart
        options["grid"].append({
            "left": f"{left}%",
            "top": f"{top}%",
            "width": f"{width}%",
            "height": f"{height}%",
            "containLabel": True
        })
        
        # Filter data for this category
        category_data = [item for item in data if item[x_field] == category]
        
        # For horizontal bar chart, swap x and y axis
        # Add y-axis (groups) - this will be the category axis for horizontal bars
        options["yAxis"].append({
            "type": "category",
            "data": groups,
            "gridIndex": i,
            "axisLabel": {
                "fontSize": 10,
                "fontWeight": "normal"
            }, 
            "nameLocation": "end",
            "nameGap": 15,
        })
        
        # Add x-axis (values) - this will be the value axis for horizontal bars
        options["xAxis"].append({
            "type": "value",
            "gridIndex": i,
            "show": variables['x_axis']['has_domain'],
            "name": y_field,
            "nameLocation": "middle",
            "nameGap": 30,
            "nameTextStyle": {
                "fontSize": 12,
                "fontWeight": "normal"
            }
        })
        
        # Create series data with colors for each group
        series_data = []
        for group in groups:
            group_value = next((item[y_field] for item in category_data if item[group_field] == group), 0)
            # Add color information for each data point based on the group
            series_data.append({
                "value": group_value,
                "itemStyle": {
                    "color": group_colors[group],
                    "borderRadius": 4 if variables['mark']['has_rounded_corners'] else 0,
                    "borderWidth": 2 if variables['mark']['has_stroke'] else 0,
                    "borderColor": variables['color']['stroke_color']
                }
            })
        
        # Add series
        options["series"].append({
            "name": category,
            "type": "bar",
            "xAxisIndex": i,
            "yAxisIndex": i,
            "data": series_data,
            "label": {
                "show": constants['data_label'] != 'none',
                "position": "right",  # For horizontal bars, labels go on the right
                "fontSize": 10,
                "fontWeight": "normal"
            },
            "encode": {
                "x": 0,  # Value axis is now x
                "y": 1   # Category axis is now y
            }
        })
        
        # Add title for this chart
        options["title"].append({
            "text": category,
            "left": f"{left + width/2}%",
            "top": f"{top - 3}%",
            "textAlign": "center",
            "textStyle": {
                "fontSize": 18,
                "fontWeight": "bold"
            }
        })
    
    return options

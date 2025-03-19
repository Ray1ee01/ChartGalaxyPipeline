'''
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Rose Chart",
    "chart_name": "rose_chart_01",
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
    Generate ECharts options for rose charts
    
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
    
    # Define dimensions based on json_data
    canvas_width = variables['width']
    canvas_height = variables['height']
    title_height = 40
    legend_height = 60
    
    # Calculate grid layout
    num_charts = len(categories)
    rows, cols = get_grid_layout(num_charts)
    
    # Adjust margin based on number of columns
    chart_margin = 20 if cols == 2 else 40  # Smaller margin for 2 columns
    
    options = {
        "title": [],
        "color": colors[:len(groups)],
        "dataset": [
            {
                "source": data
            }
        ],
        "series": [],
        "titles": []
    }
    
    # Calculate chart dimensions
    content_top = title_height + legend_height
    content_height = canvas_height - content_top
    
    # For 2 columns, use more of the available width
    if cols == 2:
        effective_width = canvas_width - (chart_margin * 3)  # Only 3 margins for 2 columns
        chart_width = effective_width / 2
    else:
        chart_width = (canvas_width - (chart_margin * (cols + 1))) / cols
        
    chart_height = (content_height - (chart_margin * (rows + 1))) / rows
    
    # Calculate rose radius based on available space
    min_dimension = min(chart_width, chart_height)
    # For 2 columns, allow slightly larger maximum radius
    max_radius = 180 if cols == 2 else 150
    outer_radius = min(min_dimension / 2, max_radius)
    
    # Add datasets for each category
    for category in categories:
        options["dataset"].append({
            "transform": [
                {
                    "type": "filter",
                    "config": {
                        "dimension": x_field,
                        "value": category
                    }
                }
            ]
        })
    
    # Add each rose chart
    for i, category in enumerate(categories):
        if i >= rows * cols:  # Safety check
            break
            
        row = i // cols
        col = i % cols
        
        # Calculate center positions in pixels
        center_x = chart_margin + (col * (chart_width + chart_margin)) + (chart_width / 2)
        center_y = content_top + chart_margin + (row * (chart_height + chart_margin)) + (chart_height / 2)
        
        # Add pie chart series with rose type
        options["series"].append({
            "name": category,
            "type": "pie",
            "roseType": "area",  # This makes it a rose chart
            "radius": [0, outer_radius],
            "center": [center_x, center_y],
            "datasetIndex": i + 1,
            "encode": {
                "itemName": group_field,
                "value": y_field
            },
            "label": {
                "show": constants['data_label'] != 'none',
                "position": "inside",
                "formatter": "{@[1]}",
                "fontSize": 14,
                "color": "white",
                "distance": 10
            },
            # Set minimum radius to ensure small values still have enough space for labels
            "minRadius": outer_radius / 5,  # Minimum radius is 1/5 of the maximum radius
            "minShowLabelAngle": 0,  # Show labels for all sectors regardless of angle size
            "startAngle": 90,
            "endAngle": 450
        })
        
        # Add title at the top of the chart
        title_y = content_top + chart_margin + (row * (chart_height + chart_margin))
        
        # Add separate title component for each rose chart
        options["title"].append({
            "text": category,
            "left": center_x,
            "top": title_y,
            "textAlign": "center",
            "textVerticalAlign": "top",
            "padding": [0, 0, 10, 0],  # Add some padding below the title
            "textStyle": {
                "fontSize": 16,
                "fontWeight": "bold",
                "color": variables['color']['text_color'],
            }
        })
    
    return options 
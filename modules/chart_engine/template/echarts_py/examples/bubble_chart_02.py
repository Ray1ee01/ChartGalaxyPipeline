'''
REQUIREMENTS_BEGIN
{
    "chart_type": "Bubble Chart",
    "chart_name": "bubble_chart_02",
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
    "required_fields_range": [[2, 12], [0, "inf"], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": ["primary"],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary", "secondary"],
    "supported_effects": ["shadow", "radius_corner"],
    "min_height": 400,
    "min_width": 650,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
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
    Generate ECharts options for bubble charts with semi-circle gauge style:
    - Semi-circle gauges (180 degrees)
    - Labels positioned above the gauge
    - No background for gauges
    
    Args:
        json_data: Dictionary containing the JSON data from input.json
        
    Returns:
        ECharts options dictionary
    """
    # Extract relevant data from json_data
    data = json_data['data']['data']
    variables = json_data['variables']
    typography = json_data['typography']
    colors_data = json_data['colors']
    images = json_data['images']
    data_columns = json_data['data']['columns']
    
    # Extract field names from data_columns
    x_field = data_columns[0]['name']  # Category
    y_field = data_columns[1]['name']  # First gauge value
    z_field = data_columns[2]['name']  # Second gauge value
    
    # Get actual display names for the fields
    y_display_name = data_columns[1].get('display_name', y_field)
    z_display_name = data_columns[2].get('display_name', z_field)
    
    # Get units for formatting
    y_unit = data_columns[1].get('unit', '%')
    z_unit = data_columns[2].get('unit', '%')
    if y_unit == 'None':
        y_unit = ''
    if z_unit == 'None':
        z_unit = ''
    if len(y_unit) > 3:
        y_unit = ''
    if len(z_unit) > 3:
        z_unit = ''
    
    # Get unique categories
    categories = sorted(list(set(item[x_field] for item in data)))
    
    # Define standard colors
    primary_color = colors_data['other'].get('primary', '#00A090')  # For first gauge
    secondary_color = colors_data['other'].get('secondary', '#FF4500')  # For second gauge
    
    # Define dimensions based on json_data
    canvas_width = variables['width']
    canvas_height = variables['height']
    title_height = 40
    legend_height = 40
    
    # Calculate grid layout
    num_charts = len(categories)
    rows, cols = get_grid_layout(num_charts)
    
    # Adjust margin based on number of columns
    chart_margin = 10 if cols == 2 else 20
    
    options = {
        "title": [],
        "legend": {
            "data": [y_display_name, z_display_name],
            "icon": "rect",
            "top": 10,
            "left": "center",
            "textStyle": {
                "fontSize": int(typography['label']['font_size'].replace('px', '')),
                "fontFamily": typography['label']['font_family'],
                "color": colors_data['text_color']
            },
            "itemWidth": 15,
            "itemHeight": 10
        },
        "color": [primary_color, secondary_color],
        "dataset": [
            {
                "source": data
            }
        ],
        "series": []
    }
    
    # Calculate chart dimensions
    content_top = title_height + legend_height
    content_height = canvas_height - content_top
    
    # For 2 columns, use more of the available width
    if cols == 2:
        effective_width = canvas_width - (chart_margin * 3)
        chart_width = effective_width / 2
    else:
        chart_width = (canvas_width - (chart_margin * (cols + 1))) / cols
        
    chart_height = (content_height - (chart_margin * (rows + 1))) / rows
    
    # Calculate base bubble radius based on available space
    min_dimension = min(chart_width, chart_height)
    base_radius = min(min_dimension / 2 - 15, 150)
    
    # Define gauge settings
    ring_width = 15  # Width of gauge ring
    
    # Add each bubble
    for i, category in enumerate(categories):
        if i >= rows * cols:  # Safety check
            break
            
        row = i // cols
        col = i % cols
        
        # Calculate center positions in pixels
        center_x = chart_margin + (col * (chart_width + chart_margin)) + (chart_width / 2)
        center_y = content_top + chart_margin + (row * (chart_height + chart_margin)) + (chart_height / 2)
        
        # Get data for this category
        category_data = None
        for item in data:
            if item[x_field] == category:
                category_data = item
                break

        if not category_data:
            continue
            
        y_value = category_data[y_field]
        z_value = category_data[z_field]
        
        # 不再基于z_value计算气泡大小，所有气泡使用相同的最大半径
        max_radius = base_radius  # 直接使用最大半径
        
        # Add category title
        options["title"].append({
            "text": category,
            "left": center_x,
            "top": center_y + max_radius * 0.6,  # Position below the gauge
            "textAlign": "center",
            "textStyle": {
                "fontSize": int(typography['label']['font_size'].replace('px', '')),
                "fontWeight": typography['label']['font_weight'],
                "fontFamily": typography['label']['font_family'],
                "color": colors_data['text_color']
            }
        })
        
        # First gauge - Primary color (top gauge)
        gauge1_series = {
            "type": "gauge",
            "name": y_display_name,
            "center": [center_x, center_y],
            "radius": max_radius,
            "min": 0,
            "max": 100,  # Fixed to 100 for percentage values
            "startAngle": 180,
            "endAngle": 0,
            "progress": {
                "show": True,
                "width": ring_width,
                "itemStyle": {
                    "color": primary_color,
                    "shadowBlur": 10 if variables.get('has_shadow', False) else 0,
                    "shadowColor": 'rgba(0, 0, 0, 0.3)' if variables.get('has_shadow', False) else 'transparent',
                    "borderRadius": 4 if variables.get('has_rounded_corners', False) else 0
                }
            },
            "pointer": {
                "show": False
            },
            "axisLine": {
                "show": False  # No background
            },
            "axisTick": {
                "show": False
            },
            "splitLine": {
                "show": False
            },
            "axisLabel": {
                "show": False
            },
            "anchor": {
                "show": False
            },
            "title": {
                "show": False
            },
            "detail": {
                "valueAnimation": True,
                "fontSize": int(typography['label']['font_size'].replace('px', '')) + 4,
                "fontWeight": "bold",
                "fontFamily": typography['label']['font_family'],
                "color": primary_color,
                "offsetCenter": [0, "-25%"],  # Position above the gauge
                "formatter": f"{y_value}{y_unit}",
                "show": True
            },
            "data": [{
                "value": y_value,
                "name": y_display_name
            }]
        }
        
        # Second gauge - Secondary color (inner gauge, slightly smaller)
        gauge2_series = {
            "type": "gauge",
            "name": z_display_name,
            "center": [center_x, center_y],
            "radius": max_radius - ring_width - 5,  # Smaller radius to fit inside
            "min": 0,
            "max": 100,  # Fixed to 100 for percentage
            "startAngle": 180,
            "endAngle": 0,
            "progress": {
                "show": True,
                "width": ring_width,
                "itemStyle": {
                    "color": secondary_color,
                    "shadowBlur": 10 if variables.get('has_shadow', False) else 0,
                    "shadowColor": 'rgba(0, 0, 0, 0.3)' if variables.get('has_shadow', False) else 'transparent',
                    "borderRadius": 4 if variables.get('has_rounded_corners', False) else 0
                }
            },
            "pointer": {
                "show": False
            },
            "axisLine": {
                "show": False  # No background
            },
            "axisTick": {
                "show": False
            },
            "splitLine": {
                "show": False
            },
            "axisLabel": {
                "show": False
            },
            "anchor": {
                "show": False
            },
            "title": {
                "show": False
            },
            "detail": {
                "valueAnimation": True,
                "fontSize": int(typography['label']['font_size'].replace('px', '')) + 4,
                "fontWeight": "bold",
                "fontFamily": typography['label']['font_family'],
                "color": secondary_color,
                "offsetCenter": [0, "0%"],  # Position in the center
                "formatter": f"{z_value}{z_unit}",
                "show": True
            },
            "data": [{
                "value": z_value,
                "name": z_display_name
            }]
        }
        
        options["series"].append(gauge1_series)
        options["series"].append(gauge2_series)
        
        # If category has an icon, add it as a separate image component
        if category in images['field']:
            options["graphic"] = options.get("graphic", [])
            # Calculate position for icon
            icon_width = min(30, max_radius * 0.3)
            icon_height = min(30, max_radius * 0.3)
            icon_x = center_x - (icon_width / 2)
            icon_y = center_y + max_radius * 0.3  # Position above the category text
            
            options["graphic"].append({
                "type": "image",
                "id": f"icon-{category}",
                "style": {
                    "image": images['field'][category],
                    "width": icon_width,
                    "height": icon_height,
                    "x": icon_x,
                    "y": icon_y
                },
                "left": icon_x,
                "top": icon_y,
                "z": 100
            })
    
    return options 
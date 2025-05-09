'''
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Gauge Chart",
    "chart_name": "multiple_gauge_chart_02",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 8], [0, 100], [2, 3]],
    "required_fields_icons": ["x"],
    "required_other_icons": ["primary"],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner"],
    "min_height": 600,
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
    Generate ECharts options for gauge charts
    
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
    x_field = data_columns[0]['name']
    y_field = data_columns[1]['name']
    group_field = data_columns[2]['name']
    
    # Get unique categories and groups
    categories = sorted(list(set(item[x_field] for item in data)))
    groups = sorted(list(set(item[group_field] for item in data)))
    
    # Limit groups to maximum of 3
    if len(groups) > 3:
        groups = groups[:3]
    
    # Create color list for groups
    colors = []
    for group in groups:
        color = colors_data['field'].get(group, colors_data['other'].get('primary', '#efb118'))
        colors.append(color)
    
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
        "color": colors,
        "dataset": [
            {
                "source": data
            }
        ],
        "series": [],
        "legend": {
            "type": "plain",
            "orient": "horizontal",
            "top": title_height,
            "left": "center",
            "data": groups,
            "textStyle": {
                "fontSize": int(typography['label']['font_size'].replace('px', '')),
                "fontFamily": typography['label']['font_family'],
                "color": colors_data['text_color']
            }
        }
    }
    
    # Calculate chart dimensions
    content_top = title_height + legend_height
    content_height = canvas_height - content_top
    unit = data_columns[1].get('unit', '')
    if len(unit) > 3:
        unit = ''
    
    # For 2 columns, use more of the available width
    if cols == 2:
        effective_width = canvas_width - (chart_margin * 3)
        chart_width = effective_width / 2
    else:
        chart_width = (canvas_width - (chart_margin * (cols + 1))) / cols
        
    chart_height = (content_height - (chart_margin * (rows + 1))) / rows
    
    # Calculate gauge radius based on available space
    min_dimension = min(chart_width, chart_height)
    max_radius = min(min_dimension / 2 - 10, 150)
    
    # Add each gauge chart
    for i, category in enumerate(categories):
        if i >= rows * cols:  # Safety check
            break
            
        row = i // cols
        col = i % cols
        
        # Calculate center positions in pixels
        center_x = chart_margin + (col * (chart_width + chart_margin)) + (chart_width / 2)
        center_y = content_top + chart_margin + (row * (chart_height + chart_margin)) + (chart_height / 2)
        
        # Add title component
        options["title"].append({
            "text": category,
            "left": center_x - 10,
            "top": center_y + max_radius - 5,
            "textAlign": "right",
            "textStyle": {
                "fontSize": int(typography['label']['font_size'].replace('px', '')),
                "fontWeight": typography['label']['font_weight'],
                "fontFamily": typography['label']['font_family'],
                "color": colors_data['text_color']
            }
        })
        
        # Get data for this category
        category_data = []
        for item in data:
            if item[x_field] == category and item[group_field] in groups:
                category_data.append({
                    "name": item[group_field],
                    "value": item[y_field]
                })

        gauge_max = max(100, max(item["value"] for item in category_data))
        
        # Create gauge series for this category
        gauge_series = []
        ring_width = 18
        if max_radius < 80:
            ring_width = 10
        
        for j, item in enumerate(category_data):
            # Adjust radius for multiple gauges
            radius = max_radius * (0.9 - (j * 0.2))
            if radius < max_radius * 0.4:
                radius = max_radius * 0.4
                
            gauge_series.append({
                "type": "gauge",
                "name": item["name"],  # Add name for legend association
                "center": [center_x, center_y],
                "radius": radius,
                "min": 0,
                "max": gauge_max,
                "startAngle": 90,
                "endAngle": 180,
                "progress": {
                    "show": True,
                    "width": ring_width,
                    "itemStyle": {
                        "color": colors[j % len(colors)],
                        "shadowBlur": 10 if variables.get('has_shadow', False) else 0,
                        "shadowColor": 'rgba(0, 0, 0, 0.3)' if variables.get('has_shadow', False) else 'transparent',
                        "borderRadius": 4 if variables.get('has_rounded_corners', False) else 0
                    }
                },
                "pointer": {
                    "show": False
                },
                "axisLine": {
                    "lineStyle": {
                        "width": ring_width,
                        "color": [[1, "white"]]
                    }
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
                    "fontSize": int(typography['label']['font_size'].replace('px', '')) + 6,
                    "fontWeight": "bold",
                    "fontFamily": typography['label']['font_family'],
                    "color": colors[j % len(colors)],
                    "offsetCenter": [-30, -max_radius + (ring_width + 5) * (j + 1)],
                    "textAlign": "right",
                    "formatter": "{value}" + unit
                },
                "data": [{
                    "value": item["value"],
                    "name": item["name"]
                }]
            })
        
        options["series"].extend(gauge_series)
        
        # If category has an icon, add it as a separate image component
        if category in images['field']:
            options["graphic"] = options.get("graphic", [])
            # Calculate position for icon
            icon_width = min(32, max_radius * 0.5)
            icon_height = min(32, max_radius * 0.5)
            icon_x = center_x + 10
            icon_y = center_y + max_radius - 10
            
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
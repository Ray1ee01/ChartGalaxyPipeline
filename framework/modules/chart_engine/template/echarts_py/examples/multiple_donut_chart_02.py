'''
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Donut Chart",
    "chart_name": "multiple_donut_chart_02",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 8], [0, "inf"], [2, 12]],
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
    Generate ECharts options for donut charts
    
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
    
    # Create color list for groups
    colors = []
    for group in groups:
        color = colors_data['field'].get(group, colors_data['other'].get('primary', '#efb118'))
        colors.append(color)
    
    # Define dimensions based on json_data
    canvas_width = variables['width']
    canvas_height = variables['height']
    title_height = 0  # Increased for larger title
    legend_height = 40
    
    # Calculate grid layout
    num_charts = len(categories)
    rows, cols = get_grid_layout(num_charts)
    
    # Adjust margin based on number of columns
    chart_margin = 10 if cols == 2 else 20  # Smaller margin for 2 columns
    
    
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
    
    # For 2 columns, use more of the available width
    if cols == 2:
        effective_width = canvas_width - (chart_margin * 3)  # Only 3 margins for 2 columns
        chart_width = effective_width / 2
    else:
        chart_width = (canvas_width - (chart_margin * (cols + 1))) / cols
        
    chart_height = (content_height - (chart_margin * (rows + 1))) / rows
    
    # Calculate donut radius based on available space
    min_dimension = min(chart_width, chart_height)
    # For 2 columns, allow slightly larger maximum radius
    max_radius = 180 if cols == 2 else 150
    outer_radius = min(min_dimension / 2 - 5, max_radius)
    inner_radius = outer_radius * 0.7
    
    # Calculate title width (slightly less than inner circle diameter)
    title_width = outer_radius * 2.5
    
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
    
    # Add each donut chart
    for i, category in enumerate(categories):
        if i >= rows * cols:  # Safety check
            break
            
        row = i // cols
        col = i % cols
        
        # Calculate center positions in pixels
        center_x = chart_margin + (col * (chart_width + chart_margin)) + (chart_width / 2)
        center_y = content_top + chart_margin + (row * (chart_height + chart_margin)) + (chart_height / 2)
        
        # Set pie style based on variables
        item_style = {
            "borderRadius": 4 if variables.get('has_rounded_corners', False) else 0,
            "borderWidth": 2 if variables.get('has_stroke', False) else 0,
            "borderColor": colors_data.get('stroke_color', '#ffffff') if variables.get('has_stroke', False) else 'transparent',
            "shadowBlur": 10 if variables.get('has_shadow', False) else 0,
            "shadowColor": 'rgba(0, 0, 0, 0.3)' if variables.get('has_shadow', False) else 'transparent'
        }
        
        # Add pie chart series
        options["series"].append({
            "name": category,
            "type": "pie",
            "radius": [inner_radius, outer_radius],
            "center": [center_x, center_y],
            "datasetIndex": i + 1,
            "encode": {
                "itemName": group_field,
                "value": y_field
            },
            "label": {
                "show": True,
                "position": "inside",
                "formatter": "{@[1]}",
                "fontSize": int(typography['label']['font_size'].replace('px', '')),
                "fontFamily": typography['label']['font_family'],
                "color": "white",
            },
            "emphasis": {
                "label": {
                    "show": True,
                    "fontSize": int(typography['label']['font_size'].replace('px', '')) + 2,
                    "fontWeight": "bold"
                },
                "itemStyle": {
                    "shadowBlur": 15,
                    "shadowColor": 'rgba(0, 0, 0, 0.5)'
                }
            },
            "itemStyle": item_style,
        })
        
        # Add separate title component for each donut
        title_text = category
        
        # Add title component without using HTML
        options["title"].append({
            "text": title_text,
            "left": center_x,
            "top": center_y - outer_radius - 15,
            "textAlign": "center",
            "textVerticalAlign": "middle",
            "width": title_width,
            "overflow": "break",
            "lineHeight": 24,
            "padding": [5, 5],
            "textStyle": {
                "fontSize": int(typography['label']['font_size'].replace('px', '')),
                "fontWeight": typography['label']['font_weight'],
                "fontFamily": typography['label']['font_family'],
                "color": colors_data['text_color'],
                "width": title_width,
                "overflow": "break",
                "lineHeight": 24
            }
        })
        
        # If country has an icon, add it as a separate image component
        if category in images['field']:
            options["graphic"] = options.get("graphic", [])
            # Calculate position for icon
            icon_width = inner_radius * 1.5
            icon_height = inner_radius * 1.5
            icon_x = center_x - (icon_width / 2)
            icon_y = center_y - (icon_height / 2)
            
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
                "opacity": 0.5,
                "z": 100
            })
    
    return options 
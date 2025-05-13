'''
REQUIREMENTS_BEGIN
{
    "chart_type": "Pie Chart",
    "chart_name": "pie_chart_02",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 8], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": ["shadow", "radius_corner"],
    "min_height": 500,
    "min_width": 650,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
'''

import math

def make_options(json_data):
    """
    Generate ECharts options for pie chart
    
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
    category_field = data_columns[0]['name']
    value_field = data_columns[1]['name']
    
    # Get unique categories
    categories = sorted(list(set(item[category_field] for item in data)))
    
    # Create color list for categories
    colors = []
    for category in categories:
        color = colors_data['field'].get(category, colors_data['other'].get('primary', '#efb118'))
        colors.append(color)
    
    # Define dimensions based on json_data
    canvas_width = variables['width']
    canvas_height = variables['height']
    title_height = 40
    legend_height = 40
    
    # Calculate available space for chart
    content_top = title_height + legend_height
    content_height = canvas_height - content_top
    
    # Calculate pie radius based on available space
    min_dimension = min(canvas_width, content_height)
    outer_radius = min(min_dimension / 2 - 50, 200)
    inner_radius = 0  # No inner hole for standard pie chart
    
    # Determine if we should place icons on the chart
    has_category_icons = any(category in images['field'] for category in categories)
    
    options = {
        "color": colors,
        "title": {
            "text": variables.get('title', ''),
            "left": 'center',
            "top": 10,
            "textStyle": {
                "fontSize": int(typography['title']['font_size'].replace('px', '')),
                "fontWeight": typography['title']['font_weight'],
                "fontFamily": typography['title']['font_family'],
                "color": colors_data['text_color']
            }
        },
        "series": [{
            "name": variables.get('series_name', ''),
            "type": "pie",
            "padAngle": 1,
            "radius": [inner_radius, outer_radius],
            "center": ['50%', content_top + content_height/2],
            "data": [{"name": item[category_field], "value": item[value_field]} for item in data],
            "label": {
                "show": True,
                "position": "outside",
                "formatter": "{b}: {c} ({d}%)",
                "fontSize": int(typography['label']['font_size'].replace('px', '')),
                "fontFamily": typography['label']['font_family'],
                "color": colors_data['text_color'],
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
            "itemStyle": {
                "borderRadius": 4 if variables.get('has_rounded_corners', False) else 0,
                "borderWidth": 2 if variables.get('has_stroke', False) else 0,
                "borderColor": colors_data.get('stroke_color', '#ffffff') if variables.get('has_stroke', False) else 'transparent',
                "shadowBlur": 10 if variables.get('has_shadow', False) else 0,
                "shadowColor": 'rgba(0, 0, 0, 0.3)' if variables.get('has_shadow', False) else 'transparent'
            }
        }]
    }
    
    # Add icons for categories if available
    if has_category_icons:
        options["graphic"] = []
        chart_center_x = canvas_width / 2
        chart_center_y = content_top + content_height / 2
        
        # Calculate the sum of all values for percentage calculations
        total_value = sum(item[value_field] for item in data)
        
        # Process each data point to calculate icon positions
        current_angle = 0  # Starting angle
        for index, item in enumerate(data):
            category = item[category_field]
            value = item[value_field]
            
            if category in images['field']:
                # Calculate angle at the middle of this slice
                slice_angle = (value / total_value) * 360
                mid_angle = current_angle + (slice_angle / 2)
                
                # Convert to radians
                mid_angle_rad = (mid_angle - 90) * (3.14159 / 180)
                
                # Calculate position on the circle
                icon_size = 32
                circle_size = icon_size * 1.5  # Slightly larger for the white circle background
                
                # Position the icon exactly at the radius of the pie chart
                # Using exact outer_radius (not 0.85) to place it right on the edge
                pos_x = chart_center_x + outer_radius * math.cos(mid_angle_rad)
                pos_y = chart_center_y + outer_radius * math.sin(mid_angle_rad)
                
                # Add white circle background
                options["graphic"].append({
                    "type": "circle",
                    "shape": {
                        "cx": 0,
                        "cy": 0,
                        "r": circle_size / 2
                    },
                    "style": {
                        "fill": "#ffffff",
                        "stroke": colors[index],
                        "lineWidth": 2
                    },
                    "left": pos_x - circle_size / 2,
                    "top": pos_y - circle_size / 2,
                    "z": 90
                })
                
                # Add the icon on top of the white circle
                options["graphic"].append({
                    "type": "image",
                    "style": {
                        "image": images['field'][category],
                        "width": icon_size,
                        "height": icon_size,
                    },
                    "left": pos_x - icon_size / 2,
                    "top": pos_y - icon_size / 2,
                    "z": 100
                })
            
            # Update the current angle for the next slice
            current_angle += slice_angle
    
    return options 
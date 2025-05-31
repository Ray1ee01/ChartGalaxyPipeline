'''
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Pie Chart",
    "chart_name": "multiple_pie_chart_01",
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
# 修复一些左边和右边数值不显示的问题
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
    chart_margin = 10 if cols == 2 else 20  # 饼图之间的间距，恢复到原始值
    
    # 为整个图表区域的左右两侧定义专门的外部填充
    outer_horizontal_padding = 40 # 您可以调整此值以获得期望的外部边距
    
    
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
    
    # Calculate chart_width considering outer_horizontal_padding and inter-chart_margin (chart_margin)
    if cols == 1:
        # 如果只有一列，它占据外部填充后的全部可用宽度
        chart_width = canvas_width - (2 * outer_horizontal_padding)
    else: # cols > 1
        # 计算所有图表间总间距
        total_inter_chart_spacing = (cols - 1) * chart_margin
        # 计算图表可用的总宽度（减去外部填充和图表间间距）
        available_width_for_charts = canvas_width - (2 * outer_horizontal_padding) - total_inter_chart_spacing
        chart_width = available_width_for_charts / cols
        
    chart_height = (content_height - (chart_margin * (rows + 1))) / rows # 垂直间距逻辑保持不变
    
    # Calculate donut radius based on available space
    min_dimension = min(chart_width, chart_height)
    # For 2 columns, allow slightly larger maximum radius
    max_radius = 180 if cols == 2 else 150
    outer_radius = min(min_dimension / 2 - 15, max_radius)
    inner_radius = 0  # Changed to 0 - no inner hole for rose chart
    
    # Fixed vertical spacing between charts
    fixed_vertical_spacing = 40  # Define a fixed vertical spacing
    
    # Calculate title width (slightly less than inner circle diameter)
    title_width = inner_radius * 1.8
    
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
        
        # Calculate center positions in pixels with fixed vertical spacing
        # 第一个图表的左边缘从 outer_horizontal_padding 之后开始
        # 后续图表根据 chart_width 和 chart_margin (图表间距)进行偏移
        center_x = outer_horizontal_padding + (col * (chart_width + chart_margin)) + (chart_width / 2)
        
        # Use fixed vertical spacing instead of dynamic calculation
        if rows == 1:
            center_y = content_top + chart_margin + (chart_height / 2)
        else:
            available_height = content_height - ((rows - 1) * fixed_vertical_spacing)
            chart_height_adjusted = available_height / rows
            center_y = content_top + (row * (chart_height_adjusted + fixed_vertical_spacing)) + (chart_height_adjusted / 2)
        
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
                "position": "outside",
                "formatter": "{@[1]}",
                "fontSize": int(typography['label']['font_size'].replace('px', '')),
                "fontFamily": typography['label']['font_family'],
                "color": colors_data['text_color'],
                "overflow": "breakAll"
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
        
        # Move title below chart instead of center
        label_y_offset = outer_radius + 15  # Position below the chart with more space
        
        # Add title component below the chart
        options["title"].append({
            "text": title_text,
            "left": center_x,
            "top": center_y + label_y_offset,  # Position below the chart
            "textAlign": "center",
            "textVerticalAlign": "top",
            "width": title_width * 1.5,  # Increase width for better text display
            "textStyle": {
                "fontSize": int(typography['label']['font_size'].replace('px', '')),
                "fontWeight": typography['label']['font_weight'],
                "fontFamily": typography['label']['font_family'],
                "color": colors_data['text_color'],
                "overflow": "truncate"  # Changed to truncate to avoid breaking text
            }
        })
        
        # If country has an icon, add it as a separate image component
        if category in images['field']:
            options["graphic"] = options.get("graphic", [])
            # Calculate position for icon
            icon_width = max(32, outer_radius * 0.75)
            icon_height = max(32, outer_radius * 0.75)
            icon_x = center_x - (icon_width / 2)
            icon_y = center_y - (icon_height / 2)  # Position above the title
            
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
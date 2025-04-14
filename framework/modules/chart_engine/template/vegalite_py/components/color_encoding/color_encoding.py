from typing import Dict
from modules.chart_engine.template.vegalite_py.utils.color_tool.base import interpolate_color2

def available_first(json_data: Dict) -> Dict:
    color = json_data['colors']['other']['primary']
    color_spec = {
        "value": color
    }
    return color_spec


def x_gradient_to_half(json_data: Dict, target_color: str) -> Dict:
    # 将颜色转换为RGB值            
    x_column = None
    data_columns = json_data['data']['columns']
    for data_column in data_columns:
        if data_column['role'] == 'x':
            x_column = data_column['name']
            break
    x_values = []
    for item in json_data['data']['data']:
        x_values.append(item[x_column])
    # 使用dict.fromkeys()保持原有顺序
    x_values = list(dict.fromkeys(x_values))
            
    color = json_data['colors']['other']['primary']

    middle_color = interpolate_color2(color, target_color, 5)[-2]
    
    color_list = interpolate_color2(color, middle_color, len(x_values))
    
    color_spec = {
        "field": x_column,
        "type": "nominal",
        "scale": {
            "domain": x_values,
            "range": color_list
        },
        "legend": None
    }
    return color_spec

def x_one_lighter(json_data: Dict) -> Dict:
    # 将颜色转换为RGB值            
    x_column = None
    data_columns = json_data['data']['columns']
    for data_column in data_columns:
        if data_column['role'] == 'x':
            x_column = data_column['name']
            break
    x_values = []
    for item in json_data['data']['data']:
        x_values.append(item[x_column])
    # 使用dict.fromkeys()保持原有顺序
    x_values = list(dict.fromkeys(x_values))
            
    color = json_data['colors']['other']['primary']
    # 取color和#000000的中间值
    middle_color = interpolate_color2(color, "#ffffff", 5)[-2]
    
    color_list =  [color] * (len(x_values) - 1) + [middle_color]
    color_spec = {
        "field": x_column,
        "type": "nominal",
        "scale": {
            "domain": x_values,
            "range": color_list
        },
        "legend": None
    }
    return color_spec

def gridient_primary_secondary_y(json_data: Dict) -> Dict:
    y_column = None
    for data_column in json_data['data']['columns']:
        if data_column['role'] == 'y':
            y_column = data_column['name']
    primary_color = json_data['colors']['othter']['primary']
    secondary_color = json_data['colors']['othter']['secondary']
    y_values = []
    for item in json_data['data']['data']:
        y_values.append(item[y_column])
    y_max = max(y_values)
    y_min = min(y_values)
    color_spec = {
        "field": y_column,
        "type": "quantitative",
        "scale": {
            "range": [primary_color, secondary_color],
            "domain": [y_min, y_max]
        },
        "legend": {
            "orient": "top"
        }
    }
    return color_spec


def x_gradient_primary_secondary(json_data: Dict) -> Dict:
    # 将颜色转换为RGB值
    x_column = None
    data_columns = json_data['data']['columns']
    for data_column in data_columns:
        if data_column['role'] == 'x':
            x_column = data_column['name']
            break
    x_values = []
    for item in json_data['data']['data']:
        x_values.append(item[x_column])
    x_values = list(dict.fromkeys(x_values))
            
    color = json_data['colors']['other']['primary']
    end_color = json_data['colors']['other']['secondary']
    color_list = interpolate_color2(color, end_color, len(x_values))
    color_list = color_list[::-1]
    color_spec = {
        "field": x_column,
        "type": "nominal",
        "scale": {
            "domain": x_values,
            "range": color_list
        },
        "legend": None
    }
    return color_spec

def color_by_sign(json_data: Dict) -> Dict:
    primary_color = json_data['colors']['other']['primary']
    secondary_color = json_data['colors']['other']['secondary']
    color_spec = {
        "field": "sign",
        "type": "nominal",
        "scale": {
            "domain": ["positive", "negative"],
            "range": [primary_color, secondary_color]
        },
        "legend": None
    }
    return color_spec
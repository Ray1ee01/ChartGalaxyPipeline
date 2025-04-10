from typing import Dict, List, Tuple, Optional, Union
import random
from modules.infographics_generator.color_utils import get_contrast_color

def get_unique_fields_and_types(
        required_fields: Union[List[str], List[List[str]]],
        required_fields_type: Union[List[List[str]], List[List[List[str]]]],
        required_fields_range: Optional[Union[List[List[int]], List[List[List[int]]]]] = None
    ) -> Tuple[List[str], Dict[str, str], List[List[int]]]:
    """Extract unique fields and their corresponding types from nested structure"""
    field_order = ['x', 'y', 'y2', 'group']  # Define the order of fields
    field_types = {}
    field_ranges = {}
    
    # Check if required_fields is a list of lists
    if required_fields and isinstance(required_fields[0], list):
        # Handle list of lists case
        for i, (fields_group, types_group) in enumerate(zip(required_fields, required_fields_type)):
            range_group = required_fields_range[i] if required_fields_range != None else [[float('-inf'), float('inf')] for _ in fields_group]
            for field, type_list, range_list in zip(fields_group, types_group, range_group):
                if field not in field_types:
                    field_types[field] = type_list[0]  # Use first type from the list
                    field_ranges[field] = range_list  # Use first range from the list
    else:
        # Handle simple list case
        range_list = required_fields_range if required_fields_range != None else [[float('-inf'), float('inf')] for _ in required_fields]
        for field, type_list, range_val in zip(required_fields, required_fields_type, range_list):
            if field not in field_types:
                field_types[field] = type_list[0]  # Use first type from the list
                field_ranges[field] = range_val  # Use first range from the list

    # Order fields according to field_order, keeping only those that exist
    ordered_fields = [field for field in field_order if field in field_types]
    ordered_ranges = [field_ranges[field] for field in ordered_fields]
    
    return ordered_fields, field_types, ordered_ranges

def analyze_templates(templates: Dict) -> Tuple[int, Dict[str, str], int]:
    """Analyze templates and return count, data requirements and unique colors count"""
    template_count = 0
    template_requirements = {}
    unique_colors = set()
    
    for engine, templates_dict in templates.items():
        for chart_type, chart_names_dict in templates_dict.items():
            for chart_name, template_info in chart_names_dict.items():
                template_count += 1
                if 'requirements' in template_info:
                    req = template_info['requirements']
                    
                    # Count unique required colors
                    if 'required_other_colors' in req:
                        for color in req['required_other_colors']:
                            unique_colors.add(color)

                    if 'required_fields_colors' in req:
                        for color in req['required_fields_colors']:
                            unique_colors.add(color)
                        
                    if 'required_fields' in req and 'required_fields_type' in req:
                        template_requirements[f"{engine}/{chart_type}/{chart_name}"] = template_info['requirements']
                    
    return template_count, template_requirements

def check_template_compatibility(data: Dict, templates: Dict, specific_chart_name: str = None) -> List[str]:
    """Check which templates are compatible with the given data"""
    compatible_templates = []
    
    # Get the combination type from the data
    combination_type = data.get("data", {}).get("type_combination", "")
    if not combination_type:
        return compatible_templates
    
    for engine, templates_dict in templates.items():
        for chart_type, chart_names_dict in templates_dict.items():
            for chart_name, template_info in chart_names_dict.items():
                template_key = f"{engine}/{chart_type}/{chart_name}"
                
                if 'requirements' in template_info:
                    req = template_info['requirements']
                    if 'required_fields' in req and 'required_fields_type' in req:
                        ordered_fields, field_types, ordered_ranges = get_unique_fields_and_types(
                            req['required_fields'],
                            req['required_fields_type'],
                            req.get('required_fields_range', None)
                        )
                        data_type_str = ' + '.join([field_types[field] for field in ordered_fields])
                        if len(req.get('required_fields_colors', [])) > 0 and len(data.get("colors", {}).get("field", [])) == 0:
                            continue

                        if len(req.get('required_fields_icons', [])) > 0 and len(data.get("images", {}).get("field", [])) == 0:
                            continue
                    
                        if combination_type != data_type_str:
                            continue
                        for i, range in enumerate(ordered_ranges):
                            if data["data"]["columns"][i]["data_type"] in ["temporal", "categorical"]:
                                key = data["data"]["columns"][i]["name"]
                                unique_values = list(set(value[key] for value in data["data"]["data"]))
                                if len(unique_values) > range[1] or len(unique_values) < range[0]:
                                    if specific_chart_name and specific_chart_name == chart_name:
                                        print(f"template {template_key} miss match", data["name"], len(unique_values), range)
                                    continue
                                else:
                                    if specific_chart_name and specific_chart_name == chart_name:
                                        print(f"template {template_key} matched", data["name"], len(unique_values), range)
                            elif data["data"]["columns"][i]["data_type"] in ["numerical"]:
                                continue
                                key = data["data"]["columns"][i]["name"]
                                min_value = min(value[key] for value in data["data"]["data"])
                                max_value = max(value[key] for value in data["data"]["data"])
                                if min_value > range[1] or max_value < range[0]:
                                    if specific_chart_name and specific_chart_name == chart_name:
                                        print(f"template {template_key} miss match", min_value, max_value, range)
                                    continue

                        # If the combination type matches the template's data type, it's compatible
                        if specific_chart_name == None or specific_chart_name == chart_name:
                            compatible_templates.append(template_key)
                        
    return compatible_templates

def select_template(compatible_templates: List[str]) -> Tuple[str, str, str]:
    """随机选择一个兼容的模板"""
    selected_template = random.choice(compatible_templates)
    engine, chart_type, chart_name = selected_template.split('/')
    return engine, chart_type, chart_name

def process_template_requirements(requirements: Dict, data: Dict) -> None:
    """处理模板的颜色要求"""
    if len(requirements["required_other_colors"]) > 0:
        for key in requirements["required_other_colors"]:
            if key == "positive" and "positive" not in data["colors"]["other"]:
                data["colors"]["other"]["positive"] = data["colors"]["other"]["primary"]
            elif key == "negative" and "negative" not in data["colors"]["other"]:
                data["colors"]["other"]["negative"] = get_contrast_color(data["colors"]["other"]["primary"]) 

    if "min_height" in requirements:
        data["variables"]["height"] = max(600, requirements["min_height"])
    if "min_width" in requirements:
        data["variables"]["height"] = max(800, requirements["min_width"])
        
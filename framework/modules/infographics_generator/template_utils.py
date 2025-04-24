from typing import Dict, List, Tuple, Optional, Union
import random
from modules.infographics_generator.color_utils import get_contrast_color

# 添加全局字典来跟踪模板使用频率
template_usage_counter = {}

def get_unique_fields_and_types(
        required_fields: Union[List[str], List[List[str]]],
        required_fields_type: Union[List[List[str]], List[List[List[str]]]],
        required_fields_range: Optional[Union[List[List[int]], List[List[List[int]]]]] = None
    ) -> Tuple[List[str], Dict[str, str], List[List[int]]]:
    """Extract unique fields and their corresponding types from nested structure"""
    field_order = ['x', 'y', 'y2', 'group', 'group2']  # Define the order of fields
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
    for field in field_ranges:
        r = field_ranges[field]
        try:
            if r[0] == "-inf":
                r[0] = float('-inf')
            if r[1] == "inf":
                r[1] = float('inf')
        except:
            pass
    ordered_ranges = [field_ranges[field] for field in ordered_fields]
    
    return ordered_fields, field_types, ordered_ranges

def analyze_templates(templates: Dict) -> Tuple[int, Dict[str, str], int]:
    """Analyze templates and return count, data requirements and unique colors count"""
    template_count = 0
    template_requirements = {}
    template_list = []
    unique_colors = set()
    
    for engine, templates_dict in templates.items():
        for chart_type, chart_names_dict in templates_dict.items():
            for chart_name, template_info in chart_names_dict.items():
                if 'base' in chart_name:
                    continue
                if engine == 'vegalite_py':
                    continue
                template_list.append(f"{chart_type} / {chart_name}")
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
                    
    #print("template_count", template_count)
    #f = open("template_list.txt", "w")
    #f.write("\n".join(template_list))
    #f.close()

    return template_count, template_requirements

block_list = ["multiple_line_graph_06", "layered_area_chart_02", "multiple_area_chart_01", "stacked_area_chart_01", "stacked_area_chart_03"]

def check_field_color_compatibility(requirements: Dict, data: Dict) -> bool:
    """Check if the field color is compatible with the template"""
    if len(requirements.get('required_fields_colors', [])) > 0 and len(data.get("colors", {}).get("field", [])) == 0:
        return False
    for field in requirements.get('required_fields_colors', []):
        field_column = None
        for col in data.get("data", {}).get("columns", []):
            if col["role"] == field:
                field_column = col
                break
        if field_column is None:
            return False
        field_name = field_column["name"]
        for value in data.get("data", {}).get("data", []):
            if value[field_name] not in data.get("colors", {}).get("field", []):
                return False
    return True

def check_field_icon_compatibility(requirements: Dict, data: Dict) -> bool:
    """Check if the field icon is compatible with the template"""
    if len(requirements.get('required_fields_icons', [])) > 0 and len(data.get("images", {}).get("field", [])) == 0:
        return False
    for field in requirements.get('required_fields_icons', []):
        field_column = None
        for col in data.get("data", {}).get("columns", []):
            if col["role"] == field:
                field_column = col
                break
        if field_column is None:
            return False
        field_name = field_column["name"]
        for value in data.get("data", {}).get("data", []):
            if value[field_name] not in data.get("images", {}).get("field", []):
                return False
    return True

def check_template_compatibility(data: Dict, templates: Dict, specific_chart_name: str = None) -> List[str]:
    """Check which templates are compatible with the given data"""
    compatible_templates = []
    
    print(f"specific_chart_name: {specific_chart_name}")
    
    # Get the combination type from the data
    combination_type = data.get("data", {}).get("type_combination", "")
    combination_types = [col["data_type"] for col in data["data"]["columns"]]
    if combination_type == "":
        combination_type = " + ".join(combination_types)

    if not combination_type:
        return compatible_templates
    
    for engine, templates_dict in templates.items():
        for chart_type, chart_names_dict in templates_dict.items():
            for chart_name, template_info in chart_names_dict.items():
                if 'base' in chart_name:
                    continue
                if chart_name in block_list:
                    continue
                if engine == 'vegalite_py':
                    continue
                    
                template_key = f"{engine}/{chart_type}/{chart_name}"
                
                try:
                    if 'requirements' in template_info:
                        req = template_info['requirements']
                        hierarchy = req.get('hierarchy', [])
                        if 'required_fields' in req and 'required_fields_type' in req:
                            ordered_fields, field_types, ordered_ranges = get_unique_fields_and_types(
                                req['required_fields'],
                                req['required_fields_type'],
                                req.get('required_fields_range', None)
                            )
                            data_types = [field_types[field] for field in ordered_fields]
                            data_type_str = ' + '.join(data_types)
                            if len(req.get('required_fields_colors', [])) > 0 and len(data.get("colors", {}).get("field", [])) == 0:
                                continue

                            if len(req.get('required_fields_icons', [])) > 0 and len(data.get("images", {}).get("field", [])) == 0:
                                continue

                            if not check_field_color_compatibility(req, data):
                                continue
                            
                            if not check_field_icon_compatibility(req, data):
                                continue

                            if len(data_types) == len(combination_types):
                                check_flag = True
                                for data_type, combination_type in zip(data_types, combination_types[:len(data_types)]):
                                    if data_type == "categorical" and (combination_type == "temporal" or combination_type == "categorical"):
                                        pass
                                    elif data_type == "numerical" and combination_type == "numerical":
                                        pass
                                    elif data_type == "temporal" and combination_type == "temporal":
                                        pass
                                    else:
                                        check_flag = False
                                        break
                                if not check_flag:
                                    continue
                            else:
                                continue

                            flag = True
                            for i, range in enumerate(ordered_ranges):
                                if i >= len(data["data"]["columns"]):
                                    flag = False
                                    break

                                if data["data"]["columns"][i]["data_type"] in ["temporal", "categorical"]:
                                    key = data["data"]["columns"][i]["name"]
                                    unique_values = list(set(value[key] for value in data["data"]["data"]))
                                    if len(unique_values) > range[1] or len(unique_values) < range[0]:
                                        flag = False
                                        break
                                    elif "dual_direction" in chart_name and min_value >= 0:
                                        flag = False
                                        break
                                    else:
                                        pass
                                        #if specific_chart_name and specific_chart_name == chart_name:
                                        #    print(f"template {template_key} matched", data["name"], len(unique_values), range)
                                elif data["data"]["columns"][i]["data_type"] in ["numerical"]:
                                    key = data["data"]["columns"][i]["name"]
                                    min_value = min(value[key] for value in data["data"]["data"])
                                    max_value = max(value[key] for value in data["data"]["data"])
                                    if min_value < range[0] or max_value > range[1]:
                                        flag = False
                                        break
                            for i, field in enumerate(ordered_fields):
                                if field == "group":
                                    x_col = [j for j, field2 in enumerate(ordered_fields) if field2 == "x"][0]
                                    x_name = data["data"]["columns"][x_col]["name"]
                                    field_name = data["data"]["columns"][i]["name"]
                                    num_unique_x  = len(list(set(value[x_name] for value in data["data"]["data"])))
                                    num_unique_comb = len(list(set(str(value[x_name]) + ' ' + str(value[field_name]) for value in data["data"]["data"])))
                                    if field in hierarchy:
                                        if num_unique_comb > num_unique_x:
                                            flag = False
                                            break
                                    else:
                                        if num_unique_comb == num_unique_x:
                                            flag = False
                                            break
                                elif field == "group2":
                                    x_col = [j for j, field2 in enumerate(ordered_fields) if field2 == "x"][0]
                                    group_col = [j for j, field2 in enumerate(ordered_fields) if field2 == "group"][0]
                                    x_name = data["data"]["columns"][x_col]["name"]
                                    group_name = data["data"]["columns"][group_col]["name"]
                                    field_name = data["data"]["columns"][i]["name"]
                                    num_unique_x  = len(list(set(str(value[x_name]) + ' ' + str(value[group_name]) for value in data["data"]["data"])))
                                    num_unique_comb = len(list(set(str(value[x_name]) + ' ' + str(value[group_name]) + ' ' + str(value[field_name]) for value in data["data"]["data"])))
                                    if field in hierarchy:
                                        if num_unique_comb > num_unique_x:
                                            flag = False
                                            break
                                    else:
                                        if num_unique_comb == num_unique_x:
                                            flag = False
                                            break
                            if flag:
                                if specific_chart_name == None or specific_chart_name == chart_name:
                                    compatible_templates.append((template_key, ordered_fields))
                except:
                    pass
    #print("compatible_templates", compatible_templates)
    return compatible_templates

def select_template(compatible_templates: List[str]) -> Tuple[str, str, str]:
    """
    根据模板使用频率选择一个兼容的模板
    使用次数较少的模板有更高的被选择概率
    权重范围为1-5，使用平滑的反比例函数
    """
    global template_usage_counter
    
    # 初始化模板使用次数
    for template_info in compatible_templates:
        template_key = template_info[0]
        if template_key not in template_usage_counter:
            template_usage_counter[template_key] = 0
    
    # 计算每个模板的权重：使用平滑的反比例函数
    template_weights = []
    for template_info in compatible_templates:
        template_key = template_info[0]
        usage_count = template_usage_counter[template_key]
        
        # 使用平滑的反比例函数: 1 + 4/(1 + usage_count/3)
        # 当usage_count为0时，权重为5
        # 随着usage_count增加，权重会平滑地下降并逐渐接近1
        weight = 1.0 + 4.0 / (1.0 + usage_count / 3.0)
        template_weights.append(weight)
    
    # 根据权重随机选择模板
    selected_index = random.choices(
        range(len(compatible_templates)), 
        weights=template_weights, 
        k=1
    )[0]
    
    [selected_template, ordered_fields] = compatible_templates[selected_index]
    
    # 更新使用计数
    template_usage_counter[selected_template] += 1
    
    engine, chart_type, chart_name = selected_template.split('/')
    return engine, chart_type, chart_name, ordered_fields

def process_template_requirements(requirements: Dict, data: Dict, engine: str, chart_name: str) -> None:
    """处理模板的颜色要求"""
    if len(requirements["required_other_colors"]) > 0:
        for key in requirements["required_other_colors"]:
            if key == "positive" and "positive" not in data["colors"]["other"]:
                data["colors"]["other"]["positive"] = data["colors"]["other"]["primary"]
            elif key == "negative" and "negative" not in data["colors"]["other"]:
                data["colors"]["other"]["negative"] = get_contrast_color(data["colors"]["other"]["primary"]) 

    # if ('donut' in chart_name or 'pie' in chart_name) and engine == 'vegalite_py':
    #     data["variables"]["height"] = 500
    #     data["variables"]["width"] = 500
    # else:
    #     if "min_height" in requirements:
    #         data["variables"]["height"] = max(600, requirements["min_height"])
    #     elif 'height' in requirements:
    #         data["variables"]["height"] = max(600, requirements["height"][0])

    #     if "min_width" in requirements:
    #         data["variables"]["width"] = max(800, requirements["min_width"])
    #     elif 'width' in requirements:
    #         data["variables"]["width"] = max(600, requirements["width"][0])
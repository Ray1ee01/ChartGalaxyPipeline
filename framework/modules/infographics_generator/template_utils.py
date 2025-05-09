from typing import Dict, List, Tuple, Optional, Union
import random
import json
from modules.infographics_generator.color_utils import get_contrast_color

# 添加全局字典来跟踪模板使用频率
template_usage_counter = {}
field_order = ['x', 'y', 'y2', 'y3', 'size', 'group', 'group2', 'group3']

def flatten(lst):
    """Flattens a nested list into a single list."""
    result = []
    for item in lst:
        if isinstance(item, list):  # Check if the item is a list
            result.extend(flatten(item))  # Recursively flatten the sublist
        else:
            result.append(item)  # Add the non-list item to the result
    return result

def get_flatten_fields(required_fields) -> List[str]:
    """Flatten a nested list of fields into a single list"""
    lst = flatten(required_fields)
    lst = [field for field in field_order if field in lst]
    return lst

def get_unique_fields_and_types(
        required_fields: Union[List[str], List[List[str]]],
        required_fields_type: Union[List[List[str]], List[List[List[str]]]],
        required_fields_range: Optional[Union[List[List[int]], List[List[List[int]]]]] = None
    ) -> Tuple[List[str], Dict[str, str], List[List[int]]]:
    """Extract unique fields and their corresponding types from nested structure"""
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
    requirement_dump = {}
    
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
                        requirement_dump[chart_name] = template_info['requirements']
      
    # print("template_count", template_count)
    f = open("template_list.txt", "w")
    f.write("\n".join(template_list))
    f.close()
    f = open("requirement_dump.json", "w")
    f.write(json.dumps(requirement_dump, indent=4))
    f.close()
    
    return template_count, template_requirements

# block_list = ["multiple_line_graph_06", "layered_area_chart_02", "multiple_area_chart_01", "stacked_area_chart_01", "stacked_area_chart_03"]
block_list = []

def check_field_color_compatibility(requirements: Dict, data: Dict) -> bool:
    """Check if the field color is compatible with the template"""
    if len(requirements.get('required_fields_colors', [])) > 0 and len(data.get("colors", {}).get("field", {}).keys()) == 0:
        return False
    data_fields = get_flatten_fields(requirements.get('required_fields',[]))
    for color_field in requirements.get('required_fields_colors', []):
        field_column = None
        for i, field in enumerate(data_fields):
            if field == color_field:
                field_column = data.get("data", {}).get("columns", {})[i]
                break
        if field_column is None:
            return False
        field_name = field_column["name"]
        for value in data.get("data", {}).get("data", []):
            if value[field_name] not in data.get("colors", {}).get("field", {}).keys():
                return False
    return True

def check_field_icon_compatibility(requirements: Dict, data: Dict) -> bool:
    """Check if the field icon is compatible with the template"""
    if len(requirements.get('required_fields_icons', [])) > 0 and len(data.get("images", {}).get("field", {}).keys()) == 0:
        return False
    data_fields = get_flatten_fields(requirements.get('required_fields',[]))
    for icon_field in requirements.get('required_fields_icons', []):
        for i, field in enumerate(data_fields):
            if field == icon_field:
                field_column = data.get("data", {}).get("columns", {})[i]
                break
        if field_column is None:
            return False
        field_name = field_column["name"]
        for value in data.get("data", {}).get("data", []):
            if value[field_name] not in data.get("images", {}).get("field", {}).keys():
                return False
    return True

def check_template_compatibility(data: Dict, templates: Dict, specific_chart_name: str = None) -> List[str]:
    """Check which templates are compatible with the given data"""
    compatible_templates = []
    
    
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
                if engine == 'vegalite_py':
                    continue
                    
                template_key = f"{engine}/{chart_type}/{chart_name}"
                
                if specific_chart_name and specific_chart_name != chart_name:
                    continue
                
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
                            # if len(req.get('required_fields_colors', [])) > 0 and len(data.get("colors", {}).get("field", [])) == 0:
                            #     # print(f"template {template_key} failed color compatibility check")
                            #     continue

                            if len(req.get('required_fields_icons', [])) > 0 and len(data.get("images", {}).get("field", [])) == 0:
                                # print(f"template {template_key} failed icon compatibility check")
                                continue

                            # if not check_field_color_compatibility(req, data):
                            #     # print(f"template {template_key} failed color compatibility check")
                            #     continue
                            
                            if not check_field_icon_compatibility(req, data):
                                # print(f"template {template_key} failed icon compatibility check")
                                continue
                            # print("data_types", data_types)
                            # print("combination_types", combination_types)
                            # 如果data_types和combination_types相同，或者data_types是combination_types的一个子序列
                            if len(data_types) == len(combination_types):# or all(data_type in combination_types for data_type in data_types):
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
                                # print(f"template {template_key} failed data type compatibility check")
                                continue

                            flag = True
                            # print("check compatibility")
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
                                    elif "diverging" in chart_name and min_value >= 0 and range[0] < 0:
                                        flag = False
                                        break
                                    elif "scatterplot" in chart_name and min_value >= 0 and range[0] < 0:
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

    
import fcntl  # 用于文件锁
def select_template(compatible_templates: List[str]) -> Tuple[str, str, str]:
    """
    根据variation.json中的使用统计选择模板
    按照使用频率分为4个level，优先选择使用较少的level
    同level内按照具体使用次数加权随机选择
    使用文件锁确保多线程安全
    """
    # 读取variation.json，使用文件锁
    try:
        with open('variation.json', 'r') as f:
            # 获取文件锁
            fcntl.flock(f, fcntl.LOCK_EX)
            try:
                variation_stats = json.load(f)
            finally:
                # 释放文件锁
                fcntl.flock(f, fcntl.LOCK_UN)
    except:
        variation_stats = {}
        
    # 获取所有模板的使用次数
    template_counts = []
    for template_info in compatible_templates:
        template_key = template_info[0]
        _, chart_type, chart_name = template_key.split('/')
        
        # 如果variation_stats为空,所有模板使用次数都为0
        if not variation_stats:
            count = 0
        else:
            if chart_type not in variation_stats:
                variation_stats[chart_type] = {"total_count": 0}
                
            if chart_name not in variation_stats[chart_type]:
                variation_stats[chart_type][chart_name] = 0
                
            count = variation_stats[chart_type][chart_name]
            
        template_counts.append((template_info, count))
    
    # 按使用次数排序并分level
    template_counts.sort(key=lambda x: x[1])
    n = len(template_counts)
    level_size = max(1, n // 4)
    # 找出使用次数最少的模板
    min_count = min(c for _, c in template_counts)
    min_level_templates = [(t, c) for t, c in template_counts if c == min_count]
    
    # 固定选择第一个最少使用的模板
    selected_index = 0
    
    selected_template, _ = min_level_templates[selected_index]
    [template_key, ordered_fields] = selected_template
    print("selected_template", selected_template)
    
    # 更新variation.json，使用文件锁
    engine, chart_type, chart_name = template_key.split('/')
    try:
        with open('variation.json', 'r+') as f:
            # 获取文件锁
            fcntl.flock(f, fcntl.LOCK_EX)
            try:
                # 重新读取以确保获取最新数据
                variation_stats = json.load(f)
                
                # 初始化如果不存在
                if chart_type not in variation_stats:
                    variation_stats[chart_type] = {"total_count": 0}
                if chart_name not in variation_stats[chart_type]:
                    variation_stats[chart_type][chart_name] = 0
                    
                # 更新计数
                variation_stats[chart_type][chart_name] += 1
                variation_stats[chart_type]["total_count"] += 1
                
                # 写入更新后的数据
                f.seek(0)
                json.dump(variation_stats, f, indent=2)
                f.truncate()
            finally:
                # 释放文件锁
                fcntl.flock(f, fcntl.LOCK_UN)
    except FileNotFoundError:
        # 如果文件不存在,创建新的variation_stats
        variation_stats = {
            chart_type: {
                "total_count": 1,
                chart_name: 1
            }
        }
        with open('variation.json', 'w') as f:
            json.dump(variation_stats, f, indent=2)
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
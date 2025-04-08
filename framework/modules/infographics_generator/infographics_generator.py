import json
import os
import sys
from typing import Dict, Optional, List, Tuple, Set, Union
from logging import getLogger
import random

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules.chart_engine.chart_engine import load_data_from_json, get_template_for_chart_name, render_chart_to_svg
from modules.chart_engine.template.template_registry import scan_templates

logger = getLogger(__name__)

def get_unique_fields_and_types(required_fields: Union[List[str], List[List[str]]], required_fields_type: List[List[str]]) -> Tuple[List[str], Dict[str, str]]:
    """Extract unique fields and their corresponding types from nested structure"""
    field_order = ['x', 'y', 'y2', 'group']  # Define the order of fields
    field_types = {}
    
    # Check if required_fields is a list of lists
    if required_fields and isinstance(required_fields[0], list):
        # Handle list of lists case
        for fields_group, types_group in zip(required_fields, required_fields_type):
            for field, type_list in zip(fields_group, types_group):
                if field not in field_types:
                    field_types[field] = type_list[0]  # Use first type from the list
    else:
        # Handle simple list case
        for field, type_list in zip(required_fields, required_fields_type):
            if field not in field_types:
                field_types[field] = type_list[0]  # Use first type from the list
    
    # Order fields according to field_order, keeping only those that exist
    ordered_fields = [field for field in field_order if field in field_types]
    
    return ordered_fields, field_types

def analyze_templates(templates: Dict) -> Tuple[int, Dict[str, str]]:
    """Analyze templates and return count and data requirements"""
    template_count = 0
    template_requirements = {}
    
    for engine, templates_dict in templates.items():
        for chart_type, chart_names_dict in templates_dict.items():
            for chart_name, template_info in chart_names_dict.items():
                template_count += 1
                if 'requirements' in template_info:
                    req = template_info['requirements']
                    if 'required_fields' in req and 'required_fields_type' in req:
                        ordered_fields, field_types = get_unique_fields_and_types(
                            req['required_fields'],
                            req['required_fields_type']
                        )
                        # Convert to format: "type1 + type2 + ..."
                        data_type_str = ' + '.join([field_types[field] for field in ordered_fields])
                        template_requirements[f"{engine}/{chart_type}/{chart_name}"] = data_type_str
                    
    return template_count, template_requirements

def check_template_compatibility(data: Dict, templates: Dict) -> List[str]:
    """Check which templates are compatible with the given data"""
    compatible_templates = []
    
    # Get the combination type from the data
    combination_type = data.get("data", {}).get("type_combination", "")
    if not combination_type:
        return compatible_templates
    
    for engine, templates_dict in templates.items():
        # Skip vegalite-py templates
        if engine == 'vegalite-py':
            continue
            
        for chart_type, chart_names_dict in templates_dict.items():
            for chart_name, template_info in chart_names_dict.items():
                template_key = f"{engine}/{chart_type}/{chart_name}"
                
                if 'requirements' in template_info:
                    req = template_info['requirements']
                    if 'required_fields' in req and 'required_fields_type' in req:
                        ordered_fields, field_types = get_unique_fields_and_types(
                            req['required_fields'],
                            req['required_fields_type']
                        )
                        data_type_str = ' + '.join([field_types[field] for field in ordered_fields])
                        
                        # If the combination type matches the template's data type, it's compatible
                        if combination_type == data_type_str:
                            compatible_templates.append(template_key)
                        
    return compatible_templates

def process(input: str, output: str, base_url: str, api_key: str) -> bool:
    """
    Pipeline入口函数，处理单个文件的信息图生成
    
    Args:
        input: 输入JSON文件路径
        output: 输出SVG文件路径
        
    Returns:
        bool: 处理是否成功
    """
    try:
        print("infographics_generator")
        # 读取输入文件
        with open(input, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # 扫描并获取所有可用的模板
        templates = scan_templates()
        
        # Count total templates
        total_templates = 0
        for engine, templates_dict in templates.items():
            for chart_type, chart_names_dict in templates_dict.items():
                total_templates += len(chart_names_dict)
        logger.info(f"\nTotal number of templates: {total_templates}")
        
        # Analyze templates and get requirements
        template_count, template_requirements = analyze_templates(templates)
        logger.info(f"Number of templates with requirements: {template_count}")
        
        # Log template requirements
        logger.info("\nTemplate data requirements:")
        for template_name, data_type in template_requirements.items():
            logger.info(f"{template_name}: {data_type}")
            
        # Check compatibility with current data
        print("check compatibility")
        compatible_templates = check_template_compatibility(data, templates)
        logger.info(f"\nNumber of compatible templates: {len(compatible_templates)}")
        
        if not compatible_templates:
            logger.error("No compatible templates found for the given data")
            return False
            
        # 随机选择一个兼容的模板
        selected_template = random.choice(compatible_templates)
        engine, chart_type, chart_name = selected_template.split('/')
        
        # 获取图表模板
        engine_obj, template = get_template_for_chart_name(chart_name)
        if engine_obj is None or template is None:
            logger.error(f"Failed to load template: {selected_template}")
            return False
            
        # 生成图表SVG
        chart_svg_path = output
        try:
            render_chart_to_svg(
                json_data=data,
                output_svg_path=chart_svg_path,
                js_file=template,
                framework=engine.split('-')[0]  # Extract framework name (echarts/d3)
            )
        except Exception as e:
            logger.error(f"Failed to generate chart SVG: {str(e)}")
            return False
            
        # 读取生成的SVG内容
        with open(chart_svg_path, "r", encoding="utf-8") as f:
            svg_content = f.read()
            
        # 创建完整的信息图SVG（目前只包含图表部分）
        final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <!-- Chart Section -->
    <g transform="translate(0, 0)">
        {svg_content}
    </g>
    
    <!-- Title Section (placeholder) -->
    <g transform="translate(0, 0)">
        <!-- Title will be added here in future -->
    </g>
</svg>"""
        
        # 保存最终SVG
        with open(output, "w", encoding="utf-8") as f:
            f.write(final_svg)
            
        return True
            
    except Exception as e:
        logger.error(f"信息图生成失败: {str(e)}")
        return False

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Infographics Generator")
    parser.add_argument("--input", type=str, required=True, help="Input JSON file path")
    parser.add_argument("--output", type=str, required=True, help="Output SVG file path")
    args = parser.parse_args()

    success = process(input=args.input, output=args.output)
    if success:
        print("Processing json successed.")
    else:
        print("Processing json failed.")

if __name__ == "__main__":
    main() 
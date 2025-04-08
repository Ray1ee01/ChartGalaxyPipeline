import json
import os
import sys
from typing import Dict, Optional, List, Tuple
from logging import getLogger

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules.chart_engine.chart_engine import load_data_from_json, get_template_for_chart_type, render_chart_to_svg
from modules.chart_engine.template.template_registry import scan_templates

logger = getLogger(__name__)

def analyze_templates(templates: Dict) -> Tuple[int, Dict[str, str]]:
    """Analyze templates and return count and data requirements"""
    template_count = 0
    template_requirements = {}
    
    for engine, templates_dict in templates.items():
        for chart_type, chart_names_dict in templates_dict.items():
            for chart_name, template_info in chart_names_dict.items():
                template_count += 1
                if 'requirements' in template_info and 'required_fields_type' in template_info['requirements']:
                    data_type = ' + '.join([item[0] for item in template_info['requirements']['required_fields_type']])
                    template_requirements[f"{engine}/{chart_type}/{chart_name}"] = data_type
                    
    return template_count, template_requirements

def check_template_compatibility(data: Dict, templates: Dict) -> List[str]:
    """Check which templates are compatible with the given data"""
    compatible_templates = []
    
    for engine, templates_dict in templates.items():
        for chart_type, chart_names_dict in templates_dict.items():
            for chart_name, template_info in chart_names_dict.items():
                if 'requirements' in template_info and 'required_fields' in template_info['requirements']:
                    required_fields = template_info['requirements']['required_fields']
                    if all(field in data for field in required_fields):
                        compatible_templates.append(f"{engine}/{chart_type}/{chart_name}")
                        
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
        
        # Analyze templates and get requirements
        template_count, template_requirements = analyze_templates(templates)
        logger.info(f"Total number of templates: {template_count}")
        
        # Log template requirements
        logger.info("\nTemplate data requirements:")
        for template_name, data_type in template_requirements.items():
            logger.info(f"{template_name}: {data_type}")
            
        # Check compatibility with current data
        compatible_templates = check_template_compatibility(data, templates)
        logger.info(f"\nNumber of compatible templates: {len(compatible_templates)}")
        logger.info("Compatible templates:")
        for template in compatible_templates:
            logger.info(f"- {template}")
        
        # 从数据中获取图表类型
        chart_type = data.get("chart_type", "bar")  # 默认使用bar类型
        
        # 获取图表模板
        engine, template = get_template_for_chart_type(chart_type)
        if engine is None or template is None:
            logger.error(f"No template found for chart type: {chart_type}")
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
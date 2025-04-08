import json
import os
from typing import Dict, Optional
from logging import getLogger
from modules.chart_engine.chart_engine import load_data_from_json, get_template_for_chart_name, render_chart_to_svg

logger = getLogger(__name__)

def process(input: str, output: str) -> bool:
    """
    Pipeline入口函数，处理单个文件的信息图生成
    
    Args:
        input: 输入JSON文件路径
        output: 输出SVG文件路径
        
    Returns:
        bool: 处理是否成功
    """
    try:
        # 读取输入文件
        with open(input, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # 获取图表名称
        chart_name = data.get("chart_name", "donut_chart_01")
        
        # 获取图表模板
        engine, template = get_template_for_chart_name(chart_name)
        if engine is None or template is None:
            logger.error(f"No template found for chart name: {chart_name}")
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
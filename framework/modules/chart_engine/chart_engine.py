import json
import os
import sys
import random
import argparse
from logging import getLogger

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
print("before import")
from modules.chart_engine.template.template_registry import get_template_for_chart_type, get_template_for_chart_name
print("after import")
from modules.chart_engine.utils.load_charts import render_chart_to_svg
from modules.chart_engine.utils.file_utils import create_temp_file, cleanup_temp_file, ensure_temp_dir, create_fallback_svg
import importlib

logger = getLogger(__name__)

def load_data_from_json(json_file_path="input.json"):
    """
    Load chart data from a JSON file
    
    Args:
        json_file_path: Path to the JSON file
        
    Returns:
        Dict containing the JSON data
    """
    with open(json_file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def process(input: str, output: str, chart_name: str = None, html_output: str = None) -> bool:
    """
    Pipeline入口函数，处理单个文件的图表生成
    
    Args:
        input: 输入JSON文件路径
        output: 输出SVG文件路径
        chart_name: 图表名称（可选）
        html_output: HTML输出路径（可选）
        
    Returns:
        bool: 处理是否成功
    """
    try:
        # Ensure tmp directory exists
        tmp_dir = ensure_temp_dir()
        
        # Load data from input JSON file
        try:
            json_data = load_data_from_json(input)
            logger.info(f"Loaded data from {input}")
        except Exception as e:
            logger.error(f"Error loading JSON data from {input}: {e}")
            return False
        
        # Determine chart name (from args, JSON, or default)
        if chart_name is None:
            # Try to get chart name from JSON data
            chart_name = json_data.get("chart_name", "donut_chart_01")
        
        logger.info(f"Using chart name: {chart_name}")
        
        # Get the appropriate template for this chart type
        engine_preference = None
        engine, template = get_template_for_chart_name(chart_name, engine_preference=engine_preference)
        
        if engine is None:
            logger.error(f"No template found for chart name '{chart_name}'")
            return False
        
        logger.info(f"Using {engine} template for {chart_name}")
        
        # Get dimensions from JSON data
        width = json_data.get("variables", {}).get("width", 1200)
        height = json_data.get("variables", {}).get("height", 800)
        logger.info(f"Using dimensions: {width}x{height}")
        
        # Determine output SVG path
        if output:
            output_svg_path = output
        else:
            # Generate a random output SVG filename in tmp directory
            output_svg_path = os.path.join(tmp_dir, input.split('.')[0].split('/')[-1] + "_" + f"{chart_name.replace(' ', '_')}.svg")
        
        svg_file = None
        error_message = None
        
        try:
            if engine == 'echarts-py':
                # Use Python template
                options = template.make_options(json_data)
                
                # Save options to temporary file
                echarts_options_file = create_temp_file(prefix="echarts_options_", suffix=".json", 
                                                    content=json.dumps(options, indent=2))
                
                # Use same renderer as echarts-js
                logger.info(f"Using ECharts renderer for Python-generated options")
                
                # Create JS wrapper function
                js_wrapper_content = f"""
                function make_option(jsonData) {{
                    return {json.dumps(options)};
                }}
                """
                
                js_wrapper_file = create_temp_file(prefix="echarts_wrapper_", suffix=".js", 
                                                content=js_wrapper_content)
                
                try:
                    # Render SVG
                    svg_file = render_chart_to_svg(
                        json_data=json_data,
                        output_svg_path=output_svg_path,
                        js_file=js_wrapper_file,
                        width=width,
                        height=height,
                        framework="echarts"
                    )
                    
                    if svg_file is None:
                        raise ValueError("SVG chart generation failed (returned None)")
                    
                    logger.info(f"ECharts SVG chart generated successfully")
                    
                finally:
                    # Clean up temporary files
                    cleanup_temp_file(js_wrapper_file)
                    cleanup_temp_file(echarts_options_file)
                
            elif engine == 'echarts-js':
                # Use unified render_chart_to_svg function
                try:
                    svg_file = render_chart_to_svg(
                        json_data=json_data,
                        output_svg_path=output_svg_path,
                        js_file=template,
                        width=width,
                        height=height,
                        framework="echarts",
                        html_output_path=html_output,
                    )
                    
                    if svg_file is None:
                        raise ValueError("SVG chart generation failed (returned None)")
                    
                    logger.info(f"ECharts SVG chart generated successfully")
                    
                except Exception as e:
                    error_message = str(e)
                    raise Exception(f"Failed to generate ECharts JavaScript chart: {error_message}")
            
            elif engine == 'd3-js':
                # Use unified render_chart_to_svg function
                try:
                    svg_file = render_chart_to_svg(
                        json_data=json_data,
                        output_svg_path=output_svg_path,
                        js_file=template,
                        width=width,
                        height=height,
                        framework="d3",
                        html_output_path=html_output,
                    )
                    
                    if svg_file is None:
                        raise ValueError("SVG chart generation failed (returned None)")
                    
                    logger.info(f"D3.js SVG chart generated successfully")
                    
                except Exception as e:
                    error_message = str(e)
                    raise Exception(f"Failed to generate D3.js chart: {error_message}")
                    
            elif engine == 'vegalite-py':
                # Use VegaLite-py template
                template_root = "template.vegalite-py"
                general_chart_type = template.split('/')[-2]
                module_name = template.split('/')[-1].split('.')[0]
                module_path = f"{template_root}.{general_chart_type}.{module_name}"
                module = importlib.import_module(module_path)
                
                chart_words = module_name.split('_')
                chart_words = [word.capitalize() for word in chart_words]
                chart_type = ''.join(chart_words)
                
                template_class = getattr(module, chart_type)
                template_object = template_class(json_data)
                vega_spec = template_object.make_specification(json_data)
                
                vega_spec_file = create_temp_file(prefix="vega_spec_", suffix=".json", 
                                                content=json.dumps(vega_spec, indent=2))
                
                try:
                    svg_file, svg_content = template_object.specification_to_svg(vega_spec, output_svg_path)
                    if svg_file is None:
                        raise ValueError("SVG chart generation failed (returned None)")
                    
                    element_tree = template_object.svg_to_element_tree(svg_content)
                    template_object.apply_variation(json_data)
                    svg_file = output_svg_path
                    svg_content = template_object.element_tree_to_svg(template_object.elements_tree)
                    with open(output_svg_path, 'w', encoding='utf-8') as f:
                        f.write(svg_content)
                    logger.info(f"VegaLite SVG chart generated successfully")
                    
                finally:
                    cleanup_temp_file(vega_spec_file)
            else:
                error_message = f"Unknown engine type: {engine}"
                logger.error(error_message)
                return False
            
            if svg_file is not None and os.path.exists(svg_file):
                logger.info(f"Final SVG output: {svg_file}")
                return True
            else:
                logger.error("Error: No SVG file was generated")
                return False
                
        except Exception as e:
            logger.error(f"Error generating chart: {e}")
            return False
            
    except Exception as e:
        logger.error(f"Error in chart generation process: {e}")
        return False

def parse_arguments():
    """
    Parse command-line arguments
    
    Returns:
        Namespace containing the parsed arguments
    """
    parser = argparse.ArgumentParser(description='Generate chart SVG from JSON data')
    parser.add_argument('--input', type=str, default='input.json',
                        help='Path to input JSON file (default: input.json)')
    parser.add_argument('--output', type=str, default=None,
                        help='Path to output SVG file (default: auto-generated in tmp directory)')
    parser.add_argument('--name', type=str, default=None,
                        help='Chart name to use (default: uses value from JSON or a default name)')
    parser.add_argument('--html', type=str, default=None,
                        help='Path to save intermediate HTML file (default: not saved)')
    
    return parser.parse_args()

if __name__ == '__main__':
    # Parse command-line arguments
    args = parse_arguments()
    
    success = process(
        input=args.input,
        output=args.output,
        chart_name=args.name,
        html_output=args.html
    )
    
    if success:
        print("Chart generation succeeded.")
    else:
        print("Chart generation failed.")
        sys.exit(1)

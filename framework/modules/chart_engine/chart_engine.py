import json
import os
import sys
import random
import argparse
from template.template_registry import get_template_for_chart_type, get_template_for_chart_name
from utils.load_charts import render_chart_to_svg
from utils.file_utils import create_temp_file, cleanup_temp_file, ensure_temp_dir, create_fallback_svg

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
    
    # Ensure tmp directory exists
    tmp_dir = ensure_temp_dir()
    
    # Load data from input JSON file
    try:
        json_data = load_data_from_json(args.input)
        print(f"Loaded data from {args.input}")
    except Exception as e:
        print(f"Error loading JSON data from {args.input}: {e}")
        sys.exit(1)
    
    # Determine chart name (from args, JSON, or default)
    chart_name = args.name
    if chart_name is None:
        # Try to get chart name from JSON data (if your JSON structure contains this info)
        chart_name = json_data.get("chart_name", "donut_chart_01")
    
    print(f"Using chart name: {chart_name}")
    
    # Get the appropriate template for this chart type
    # Prefer JavaScript template for testing
    engine, template = get_template_for_chart_name(chart_name, engine_preference=['echarts-js', 'echarts-py', 'd3-js'])
    
    if engine is None:
        print(f"Error: No template found for chart name '{chart_name}'")
        sys.exit(1)
    
    print(f"Using {engine} template for {chart_name}")
    
    # Get dimensions from JSON data
    width = json_data.get("variables", {}).get("width", 1200)
    height = json_data.get("variables", {}).get("height", 800)
    print(f"Using dimensions: {width}x{height}")
    
    # Determine output SVG path
    if args.output:
        output_svg_path = args.output
    else:
        # Generate a random output SVG filename in tmp directory
        output_svg_path = os.path.join(tmp_dir, f"{chart_name.replace(' ', '_')}_{random.randint(1000, 9999)}.svg")
    
    # Check if HTML output is requested
    html_output_path = args.html
    if html_output_path:
        print(f"HTML output will be saved to: {html_output_path}")
    
    svg_file = None
    error_message = None
    
    try:
        if engine == 'echarts-py':
            # Use Python template
            options = template.make_options(json_data)
            
            # 保存options到临时文件
            echarts_options_file = create_temp_file(prefix="echarts_options_", suffix=".json", 
                                                content=json.dumps(options, indent=2))
            
            # 使用echarts-js相同的渲染方式
            print(f"Using ECharts renderer for Python-generated options")
            
            # 创建JS封装函数
            js_wrapper_content = f"""
            function make_option(jsonData) {{
                return {json.dumps(options)};
            }}
            """
            
            js_wrapper_file = create_temp_file(prefix="echarts_wrapper_", suffix=".js", 
                                            content=js_wrapper_content)
            
            try:
                # 渲染SVG
                svg_file = render_chart_to_svg(
                    json_data=json_data,
                    output_svg_path=output_svg_path,
                    js_file=js_wrapper_file,
                    width=width,
                    height=height,
                    framework="echarts",  # 统一使用echarts框架
                    html_output_path=html_output_path,  # Pass HTML output path
                )
                
                if svg_file is None:
                    raise ValueError("SVG chart generation failed (returned None)")
                
                print(f"ECharts SVG chart generated successfully")
                
            except Exception as e:
                error_message = str(e)
                raise Exception(f"Failed to generate ECharts Python chart: {error_message}")
            finally:
                # 清理临时文件
                cleanup_temp_file(js_wrapper_file)
                cleanup_temp_file(echarts_options_file)
            
        elif engine == 'echarts-js':
            # 使用统一的render_chart_to_svg函数直接生成SVG
            try:
                svg_file = render_chart_to_svg(
                    json_data=json_data,
                    output_svg_path=output_svg_path,
                    js_file=template,
                    width=width,
                    height=height,
                    framework="echarts",
                    html_output_path=html_output_path,  # Pass HTML output path
                )
                
                if svg_file is None:
                    raise ValueError("SVG chart generation failed (returned None)")
                
                print(f"ECharts SVG chart generated successfully")
                
            except Exception as e:
                error_message = str(e)
                raise Exception(f"Failed to generate ECharts JavaScript chart: {error_message}")
        
        elif engine == 'd3-js':
            # 使用统一的render_chart_to_svg函数直接生成SVG
            try:
                svg_file = render_chart_to_svg(
                    json_data=json_data,
                    output_svg_path=output_svg_path,
                    js_file=template,
                    width=width,
                    height=height,
                    framework="d3",
                    html_output_path=html_output_path,  # Pass HTML output path
                )
                
                if svg_file is None:
                    raise ValueError("SVG chart generation failed (returned None)")
                
                print(f"D3.js SVG chart generated successfully")
                
            except Exception as e:
                error_message = str(e)
                raise Exception(f"Failed to generate D3.js chart: {error_message}")
                
        else:
            error_message = f"Unknown engine type: {engine}"
            print(f"Error: {error_message}")
            raise Exception(error_message)
    
    except Exception as e:
        print(f"Error generating chart: {e}")
        error_message = str(e)
        
        # Create a fallback SVG with error message as a last resort
        if svg_file is None or not os.path.exists(svg_file):
            print("Creating fallback SVG with error message...")
            svg_file = create_fallback_svg(
                output_path=output_svg_path,
                width=width,
                height=height,
                error_message=error_message
            )
    
    if svg_file is not None and os.path.exists(svg_file):
        # Output the final SVG path
        print(f"Final SVG output: {svg_file}")
    else:
        print("Error: No SVG file was generated")
        sys.exit(1)

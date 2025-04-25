import json
import os
import sys
import random
import argparse
from modules.chart_engine.template.template_registry import get_template_for_chart_type, get_template_for_chart_name
from modules.chart_engine.utils.load_charts import render_chart_to_svg
from modules.chart_engine.utils.file_utils import create_temp_file, cleanup_temp_file, ensure_temp_dir, create_fallback_svg
import importlib

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
    engine_preference = None
    engine, template = get_template_for_chart_name(chart_name, engine_preference=engine_preference)
    
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
        output_svg_path = os.path.join(tmp_dir, args.input.split('.')[0].split('/')[-1] + "_" + f"{chart_name.replace(' ', '_')}.svg")
    
    # Check if HTML output is requested
    html_output_path = args.html
    if html_output_path:
        print(f"HTML output will be saved to: {html_output_path}")
    
    svg_file = None
    error_message = None
    
    # 可用的输入：engine: 名字， template: 模板对应的文件路径，chart_type: 图表类型，json_data: 图表数据
    
    # try:
    if engine == 'echarts_py':
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
            
    elif engine == 'vegalite_py':
        # Use vegalite_py template
        print("template:", template)
        template_root = "template.vegalite_py"
        general_chart_type = template.split('/')[-2]
        module_name = template.split('/')[-1].split('.')[0]
        print("module_name:", module_name)
        print("")
        module_path = f"{template_root}.{general_chart_type}.{module_name}"
        print("module_path:", module_path)
        module = importlib.import_module(module_path)
        
        chart_words = module_name.split('_')
        # 把每个单词的首字母大写
        chart_words = [word.capitalize() for word in chart_words]
        # 把每个单词拼接起来
        chart_type = ''.join(chart_words)
        print("chart_type:", chart_type)
        
        # 获取module所有的attribute
        # attributes = dir(module)
        template_class = getattr(module, chart_type)
        template_object = template_class(json_data)
        vega_spec = template_object.make_specification(json_data)
        # 保存vega_spec到临时文件
        vega_spec_file = create_temp_file(prefix="vega_spec_", suffix=".json", 
                                            content=json.dumps(vega_spec, indent=2))
        
        # try:
        svg_file, svg_content = template_object.specification_to_svg(vega_spec, output_svg_path)
        with open("debug.svg", "w", encoding='utf-8') as f:
            f.write(svg_content)
        if svg_file is None:
            raise ValueError("SVG chart generation failed (returned None)")
        # print("svg_content:", svg_content)
        element_tree = template_object.svg_to_element_tree(svg_content)
        print("element_tree:", element_tree)
        template_object.apply_variation(json_data)
        svg_file = output_svg_path
        svg_content = template_object.element_tree_to_svg(template_object.elements_tree)
        with open(output_svg_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)
        print(f"VegaLite SVG chart generated successfully")
            
        # except Exception as e:
        #     error_message = str(e)
        #     raise Exception(f"Failed to generate VegaLite chart: {error_message}")
    else:
        error_message = f"Unknown engine type: {engine}"
        print(f"Error: {error_message}")
        raise Exception(error_message)
    
    # except Exception as e:
    #     print(f"Error generating chart: {e}")
    #     error_message = str(e)
        
    #     # Create a fallback SVG with error message as a last resort
    #     if svg_file is None or not os.path.exists(svg_file):
    #         print("Creating fallback SVG with error message...")
    #         svg_file = create_fallback_svg(
    #             output_path=output_svg_path,
    #             chart_type=chart_type,
    #             width=width,
    #             height=height,
    #             error_message=error_message
    #         )
    
    if svg_file is not None and os.path.exists(svg_file):
        # Output the final SVG path
        print(f"Final SVG output: {svg_file}")
    else:
        print("Error: No SVG file was generated")
        sys.exit(1)

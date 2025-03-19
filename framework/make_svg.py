import json
import os
import sys
import random
from template.template_registry import get_template_for_chart_type
from utils.html_to_svg import html_to_svg
from utils.load_charts import load_js_echarts, load_py_echarts, render_chart_to_svg, load_d3js
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

def determine_chart_type(json_data):
    """
    Determine the appropriate chart type based on the JSON data
    
    Args:
        json_data: The JSON data containing chart information
    
    Returns:
        String indicating the chart type
    """
    # For testing purpose - this time we want to use the JS template
    return "Grouped Bar Chart"
    #return json_data['requirements']['chart_type'].lower()

if __name__ == '__main__':
    # 只保留必要的日志输出
    # Ensure tmp directory exists
    tmp_dir = ensure_temp_dir()
    
    # Load data from input.json
    json_data = load_data_from_json()
    
    # Determine chart type based on the JSON data
    chart_type = determine_chart_type(json_data)
    print(f"Detected chart type: {chart_type}")
    
    # Get the appropriate template for this chart type
    # Prefer JavaScript template for testing
    engine, template = get_template_for_chart_type(chart_type, engine_preference=['echarts-js', 'echarts-py', 'd3-js'])
    
    if engine is None:
        print(f"Error: No template found for chart type '{chart_type}'")
        sys.exit(1)
    
    print(f"Using {engine} template for {chart_type}")
    
    # Get dimensions from JSON data
    width = json_data.get("variables", {}).get("width", 1200)
    height = json_data.get("variables", {}).get("height", 800)
    print(f"Using dimensions: {width}x{height}")
    
    # Generate a random output SVG filename
    output_svg_path = os.path.join(tmp_dir, f"{chart_type.replace(' ', '_')}_{random.randint(1000, 9999)}.svg")
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
                    chart_type=chart_type,
                    width=width,
                    height=height,
                    framework="echarts"  # 统一使用echarts框架
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
            # Use JavaScript ECharts template
            js_file = template
            
            # 使用统一的render_chart_to_svg函数直接生成SVG
            try:
                svg_file = render_chart_to_svg(
                    json_data=json_data,
                    output_svg_path=output_svg_path,
                    js_file=js_file,
                    chart_type=chart_type,
                    width=width,
                    height=height,
                    framework="echarts"
                )
                
                if svg_file is None:
                    raise ValueError("SVG chart generation failed (returned None)")
                
                print(f"ECharts SVG chart generated successfully")
                
            except Exception as e:
                error_message = str(e)
                raise Exception(f"Failed to generate ECharts JavaScript chart: {error_message}")
        
        elif engine == 'd3-js':
            # Use D3.js template
            js_code = template
            
            # Add chart_type to the data if not already present
            if "chart_type" not in json_data:
                json_data["chart_type"] = chart_type
            
            # 使用统一的render_chart_to_svg函数直接生成SVG
            try:
                svg_file = render_chart_to_svg(
                    json_data=json_data,
                    output_svg_path=output_svg_path,
                    js_file=js_code,
                    chart_type=chart_type,
                    width=width,
                    height=height,
                    framework="d3"
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
                chart_type=chart_type,
                width=width,
                height=height,
                error_message=error_message
            )
    
    if svg_file is not None and os.path.exists(svg_file):
        # 使用文件名而非完整路径
        filename = os.path.basename(svg_file)
        print(f"Final SVG output: {filename}")
    else:
        print("Error: No SVG file was generated")
        sys.exit(1)

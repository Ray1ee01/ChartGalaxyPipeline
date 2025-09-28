import json
import os
import sys
import random
import argparse
from logging import getLogger

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules.chart_engine.variation.template_registry import get_variation_for_chart_type, get_variation_for_chart_name
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
        engine, template = get_variation_for_chart_name(chart_name, engine_preference=engine_preference)
        
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
            if engine == 'd3-js':
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

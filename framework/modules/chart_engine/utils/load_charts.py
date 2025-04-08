import os
import json
import subprocess
import tempfile
from .file_utils import create_temp_file, create_temp_dir, cleanup_temp_file, cleanup_temp_dir
from .html_to_svg import html_to_svg  # Import the html_to_svg utility

def _save_to_file(content, output_file=None, prefix="", suffix=".html"):
    """
    Helper function to save content to a file, creating a temporary file if needed
    
    Args:
        content: Content to write to the file
        output_file: Path to save the file (optional)
        prefix: Prefix for temp filename
        suffix: Suffix for temp filename
        
    Returns:
        Path to the created file
    """
    if output_file is None:
        prefix = f"{prefix}_"
        output_file = create_temp_file(prefix=prefix, suffix=suffix, content=content)
    else:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return output_file

def _get_dimensions(options, default_width=1200, default_height=800):
    """
    Helper function to extract width and height from options
    
    Args:
        options: Chart options
        default_width: Default width if not specified in options
        default_height: Default height if not specified in options
        
    Returns:
        Tuple of (width, height)
    """
    if not isinstance(options, dict) or "variables" not in options:
        return default_width, default_height
    
    width = options["variables"].get("width", default_width)
    height = options["variables"].get("height", default_height)
    return width, height

def _load_js_code(js_file, base_dirs=None):
    """
    Helper function to load JavaScript code from a file
    
    Args:
        js_file: Path to the JavaScript file (optional)
        base_dirs: List of base directories to search for JavaScript files
        
    Returns:
        String containing the JavaScript code
    """
    # If js_file is provided and exists, use it
    if js_file and os.path.exists(js_file):
        with open(js_file, 'r', encoding='utf-8') as f:
            return f.read()
    
    raise ValueError(f"No JavaScript file found for chart path: {js_file}. Please provide a valid JS file.")

def load_js_echarts(json_data=None, output_file=None, js_file=None):
    """
    Generate an ECharts chart using JavaScript.
    This function directly generates an HTML file with the JavaScript code.
    
    Args:
        json_data: Dict containing the JSON data for the chart
        output_file: Path to save the HTML output file (optional, will create a temp file if None)
        js_file: Path to the JavaScript file containing the make_option function
        
    Returns:
        Path to the generated HTML file
    """
    if json_data is None:
        raise ValueError("JSON data must be provided")
    
    width, height = _get_dimensions(json_data)
        
    # Default HTML template
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>ECharts Chart</title>
        <script src="%s"></script>
        <style>
            #chart-container {
                width: %dpx;
                height: %dpx;
            }
        </style>
    </head>
    <body>
        <div id="chart-container"></div>
        <script>
            // 立即初始化图表，使用SVG渲染器并禁用所有动画
            var chart = echarts.init(document.getElementById('chart-container'), null, {
                renderer: 'svg',
                animation: false,
                useUTC: true
            });
            
            // 禁用全局动画
            echarts.disableAllAnimation = true;
            
            // 准备数据
            const jsonData = JSON_DATA_PLACEHOLDER;
            
            JS_CODE_PLACEHOLDER
            
            // 创建图表选项
            let option;
            try {
                option = make_option(jsonData);
                
                // 禁用所有动画
                option.animation = false;
                option.animationDuration = 0;
                option.animationDurationUpdate = 0;
                option.animationDelay = 0;
                option.animationDelayUpdate = 0;
                
            } catch (e) {
                console.error("Error creating chart:", e);
                option = {
                    title: { text: "Error: " + e.message, left: 'center' }
                };
            }
            
            // 立即设置选项并渲染
            chart.setOption(option);
            
            // 导出SVG的优化函数
            function exportSvg() {
                try {
                    chart.setOption(option, {notMerge: true});
                    
                    const svgContent = chart.renderToSVGString();
                    
                    if (svgContent && svgContent.length > 0) {
                        const svgContainer = document.createElement('div');
                        svgContainer.id = 'svg-output';
                        svgContainer.style.display = 'none';
                        svgContainer.innerHTML = svgContent;
                        document.body.appendChild(svgContainer);
                    }
                } catch (e) {
                    console.error("Error exporting SVG:", e);
                }
            }
            
            // 立即尝试导出
            exportSvg();
            
            // 设置备用导出计时器，500ms后再尝试一次
            setTimeout(exportSvg, 500);
        </script>
    </body>
    </html>
    """
    
    # 获取本地库文件的绝对路径
    echarts_lib_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'lib', 'echarts.min.js'))
    
    # 使用文件协议的URL (用于SVG渲染)
    echarts_lib_url = f"file://{echarts_lib_path}"
    
    # Load JavaScript code
    js_code = _load_js_code(js_file)
    
    # Create HTML content
    formatted_html = html_template % (echarts_lib_url, width, height)
    formatted_html = formatted_html.replace('JSON_DATA_PLACEHOLDER', json.dumps(json_data))
    formatted_html = formatted_html.replace('JS_CODE_PLACEHOLDER', js_code)
    
    # Save the HTML to a file
    output_file = _save_to_file(formatted_html, output_file)
    
    # 简化日志输出
    return output_file

def load_d3js(json_data=None, output_file=None, js_file=None):
    """
    Generate a D3.js chart using JavaScript.
    This function generates an HTML file with the D3.js code.
    
    Args:
        json_data: Dict containing the JSON data for the chart
        output_file: Path to save the HTML output file (optional, will create a temp file if None)
        js_file: Path to the JavaScript file containing the D3.js implementation
        
    Returns:
        Path to the generated HTML file
    """
    if json_data is None:
        raise ValueError("JSON data must be provided")
    
    width, height = _get_dimensions(json_data, default_width=800, default_height=600)
        
    # Default HTML template for D3.js - use %% to escape % characters
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>D3.js Chart</title>
        <script src="%s"></script>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
            }
            #chart-container {
                width: 100%%;
                max-width: %dpx;
                height: %dpx;
                margin: 0 auto;
                background-color: white;
                border-radius: 8px;
                overflow: hidden;
            }
        </style>
    </head>
    <body>
        <div id="chart-container"></div>
        <script>
            // 准备数据
            const json_data = JSON_DATA_PLACEHOLDER;
            
            // D3.js实现
            JS_CODE_PLACEHOLDER
            
            // 文档就绪时立即创建图表
            makeChart('#chart-container', json_data);
            
            // 500ms后检查SVG是否已生成
            setTimeout(function() {
                const svg = document.querySelector('#chart-container svg');
                if (svg) {
                    // 创建一个包含SVG内容的容器供提取使用
                    const svgContainer = document.createElement('div');
                    svgContainer.id = 'svg-output';
                    svgContainer.style.display = 'none';
                    svgContainer.innerHTML = svg.outerHTML;
                    document.body.appendChild(svgContainer);
                }
            }, 500);
        </script>
    </body>
    </html>
    """
    
    # 获取D3.js库文件的绝对路径
    d3_lib_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'lib', 'd3.min.js'))
    
    # 使用文件协议的URL (用于SVG渲染)
    d3_lib_url = f"file://{d3_lib_path}"
    
    js_code = _load_js_code(js_file)
    
    # Create HTML content    
    formatted_html = html_template % (d3_lib_url, width, height)
    formatted_html = formatted_html.replace('JSON_DATA_PLACEHOLDER', json.dumps(json_data))
    formatted_html = formatted_html.replace('JS_CODE_PLACEHOLDER', js_code)
    
    # Save the HTML to a file
    output_file = _save_to_file(formatted_html, output_file, prefix="_d3")
    
    # 简化日志输出
    return output_file

def load_py_echarts(json_data=None):
    """
    Process ECharts options for SVG conversion
    
    Args:
        json_data (dict): 包含图表数据和配置的JSON数据
        
    Returns:
        Dict containing the processed JSON data
    """
    if not json_data:
        raise ValueError("JSON data must be provided")
                
    # 不需要特殊处理，直接返回处理好的选项数据
    return json_data

def render_chart_to_svg(json_data, output_svg_path, js_file=None, width=None, height=None, framework="echarts", html_output_path=None):
    """
    通用的图表渲染函数，支持多种图表框架
    
    Args:
        json_data (dict): 完整的JSON数据，包含图表数据和配置信息
        output_svg_path (str): SVG文件保存路径
        js_file (str, optional): JavaScript文件路径
        width (int, optional): 图表宽度(像素)
        height (int, optional): 图表高度(像素)
        framework (str): 使用的图表框架，可选"echarts"或"d3"
        html_output_path (str, optional): 保存中间HTML文件的路径
        
    Returns:
        Path to the generated SVG file
    """
    # 获取宽度和高度
    if width is None or height is None:
        w, h = _get_dimensions(json_data)
        width = width or w
        height = height or h
    
    # 为引擎创建临时目录，用于生成HTML文件
    temp_dir = create_temp_dir(prefix=f"{framework}_svg_")
    html_file = os.path.join(temp_dir, 'chart.html')
    
    try:
        # 根据框架类型生成HTML文件
        if framework.lower() == "echarts" or framework.lower() == "echarts-py":
            html_content = load_js_echarts(json_data=json_data, output_file=html_file, js_file=js_file)
        elif framework.lower() == "d3":
            html_content = load_d3js(json_data=json_data, output_file=html_file, js_file=js_file)
        else:
            raise ValueError(f"Unsupported framework: {framework}")
        
        # 如果指定了HTML输出路径，创建HTML文件副本并处理CDN URL
        if html_output_path and os.path.exists(html_file):
            import shutil
            import re
            
            # 确保目标目录存在
            os.makedirs(os.path.dirname(os.path.abspath(html_output_path)), exist_ok=True)
            
            # 读取HTML内容
            with open(html_file, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # 确定库文件名
            lib_file = 'echarts.min.js' if framework.lower().startswith('echarts') else 'd3.min.js'
            
            # 替换file://路径为CDN URL (使用通用的CDN)
            file_pattern = r'file://.*?/' + lib_file
            
            # 确定CDN URL
            if framework.lower().startswith('echarts'):
                cdn_url = "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"
            else:  # D3.js
                cdn_url = "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"
            
            html_content = re.sub(file_pattern, cdn_url, html_content)
            
            # 将处理后的HTML内容写入到输出文件
            with open(html_output_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
                
            print(f"Saved intermediate HTML file to: {html_output_path}")
        
        # 使用html_to_svg转换为SVG
        svg_file = html_to_svg(html_file, output_svg_path, width=width, height=height)
        
        if svg_file is not None and os.path.exists(svg_file):
            # 简化日志输出，只返回路径，不打印
            return svg_file
        else:
            raise Exception(f"Failed to create SVG file from {framework.upper()} HTML")
    
    except Exception as e:
        print(f"Error: {e}")
        return None
    
    finally:
        # 清理临时目录
        if os.path.exists(temp_dir):
            cleanup_temp_dir(temp_dir)

# 保持向后兼容的函数
def render_d3js_chart_to_svg(json_data, output_svg_path, js_file=None, width=None, height=None, html_output_path=None):
    """
    渲染D3.js图表为SVG (向后兼容函数)
    
    Args:
        json_data (dict): 图表数据和选项
        output_svg_path (str): SVG文件保存路径
        js_file (str): D3.js实现文件的路径
        width (int, optional): 图表宽度(像素)
        height (int, optional): 图表高度(像素)
        html_output_path (str, optional): 保存中间HTML文件的路径
        
    Returns:
        Path to the generated SVG file
    """
    # 调用统一的渲染函数
    return render_chart_to_svg(
        json_data=json_data,
        output_svg_path=output_svg_path,
        js_file=js_file,
        width=width,
        height=height,
        framework="d3",
        html_output_path=html_output_path
    ) 


def render_vegalite_specification_to_svg(vegalite_specification, output_svg_path):
    import subprocess
    import json
    import os
    import random
    class NodeBridge:
        @staticmethod
        def execute_node_script(script_path: str, data: dict) -> str:
            # 生成一个随机种子
            random.seed(random.randint(0, 1000000))
            # 将数据写入临时JSON文件
            tmp_input = f'temp_input_{random.randint(0, 1000000)}.json'
            
            with open(tmp_input, 'w', encoding='utf-8') as f:
                json.dump(data, f)
            # 执行Node.js脚本
            result = subprocess.run([
                'node', script_path, tmp_input
            ], capture_output=True, encoding='utf-8')
            # 清理临时文件
            os.remove(tmp_input)
            

            if result.returncode != 0:
                raise Exception(f"Node.js执行错误: {result.stderr}")

            return result.stdout
    script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'template', 'vegalite-py', 'vega_spec.js')
    result = NodeBridge.execute_node_script(script_path, {
        "spec": vegalite_specification,
    })
    # 把result写入output_svg_path
    with open(output_svg_path, 'w', encoding='utf-8') as f:
        f.write(result)
    return output_svg_path

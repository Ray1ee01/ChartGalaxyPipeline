import os
import re
import json
import importlib.util
import random

# Regular expression to extract requirements JSON from template files
REQUIREMENTS_PATTERN = re.compile(r'REQUIREMENTS_BEGIN\s*({.*?})\s*REQUIREMENTS_END', re.DOTALL)

# Dictionary to store template mappings
templates = {
    'echarts_py': {},  # chart_type -> module
    'echarts-js': {},  # chart_type -> js_file_path
    'd3-js': {},        # chart_type -> js_file_path
    'vegalite_py': {}   # chart_type -> module
}

# 全局标识符，用于跟踪是否已扫描过模板
_templates_scanned = False

def load_python_template(file_path):
    """Load a Python template module from a file path"""
    module_name = os.path.basename(file_path).replace('.py', '')
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def extract_requirements(file_path):
    """Extract requirements JSON from a template file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find requirements section
    match = REQUIREMENTS_PATTERN.search(content)
    if match:
        try:
            requirements = json.loads(match.group(1))
            return requirements
        except json.JSONDecodeError:
            print(f"Warning: Invalid JSON in requirements section of {file_path}")
    return None

def scan_directory(dir_path, engine_type, file_extension):
    """
    递归扫描目录及其子目录，寻找符合条件的模板文件
    
    Args:
        dir_path: 要扫描的目录路径
        engine_type: 引擎类型，'echarts_py', 'echarts-js' 或 'd3-js'
        file_extension: 文件扩展名，'.py' 或 '.js'
    """
    if not os.path.exists(dir_path):
        return
    
    # 遍历目录中的所有文件和子目录
    for item in os.listdir(dir_path):
        item_path = os.path.join(dir_path, item)
        
        # 如果是目录，递归扫描
        if os.path.isdir(item_path):
            scan_directory(item_path, engine_type, file_extension)
        
        # 如果是符合条件的文件
        elif os.path.isfile(item_path) and item.endswith(file_extension):
            # 对于Python文件，跳过以__开头的文件
            if file_extension == '.py' and item.startswith('__'):
                continue
                
            # 提取需求并注册模板
            requirements = extract_requirements(item_path)
            # if engine_type == 'vegalite_py':
            #     print(f"requirements: {requirements['chart_name']}")
            if requirements and 'chart_type' in requirements:
                chart_type = requirements['chart_type'].lower()
                
                # 获取chart_name，如果没有则使用文件名
                chart_name = requirements.get('chart_name', os.path.basename(item_path).split('.')[0]).lower()
                
                # 如果该chart_type还不存在，初始化一个空字典
                if chart_type not in templates[engine_type]:
                    templates[engine_type][chart_type] = {}
                
                # 根据引擎类型处理不同的模板
                if engine_type == 'echarts_py':
                    template = load_python_template(item_path)
                else:  # echarts-js 或 d3-js
                    template = item_path
                
                # 存储模板信息为 [engine, template]
                templates[engine_type][chart_type][chart_name] = {
                    'engine_type': engine_type,
                    'template': template,
                    'requirements': requirements
                }
                    
                # 计算相对于模板引擎主目录的路径
                template_dir = os.path.dirname(os.path.abspath(__file__))
                engine_dir = os.path.join(template_dir, engine_type)
                rel_path = os.path.relpath(item_path, engine_dir)
                # print(f"Registered {engine_type} template: {chart_type} -> {chart_name} -> {rel_path}")

def scan_templates(force=False):
    """
    扫描模板目录并构建映射
    
    Args:
        force: 如果为True，即使已经扫描过也会强制重新扫描
    """
    global _templates_scanned
    
    # 如果已经扫描过且不强制重新扫描，则直接返回
    if _templates_scanned and not force:
        return templates
    
    # 清空现有模板
    templates['vegalite_py'].clear()
    templates['echarts_py'].clear()
    templates['echarts-js'].clear()
    templates['d3-js'].clear()
    
    template_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 扫描 echarts_py 目录及子目录
    echarts_py_dir = os.path.join(template_dir, 'echarts_py')
    scan_directory(echarts_py_dir, 'echarts_py', '.py')
    
    # 扫描 echarts-js 目录及子目录
    echarts_js_dir = os.path.join(template_dir, 'echarts-js')
    scan_directory(echarts_js_dir, 'echarts-js', '.js')
    
    # 扫描 d3-js 目录及子目录
    d3_js_dir = os.path.join(template_dir, 'd3-js')
    scan_directory(d3_js_dir, 'd3-js', '.js')
    
    # 扫描 vegalite_py 目录及子目录
    vegalite_py_dir = os.path.join(template_dir, 'vegalite_py')
    scan_directory(vegalite_py_dir, 'vegalite_py', '.py')
    
    # 标记已完成扫描
    _templates_scanned = True
    return templates

def get_template_for_chart_type(chart_type, engine_preference=None):
    """
    Get the best template for a given chart type
    
    Args:
        chart_type: The chart type to look for
        engine_preference: Optional list of engine preferences ['echarts_py', 'echarts-js', 'd3-js']
                          in the order of preference
                          
    Returns:
        tuple of (engine, template) where template is either a module or file path
    """
    global _templates_scanned
    
    # 如果尚未扫描模板，先扫描
    if not _templates_scanned:
        scan_templates()
    
    chart_type = chart_type.lower()
    if engine_preference is None:
        engine_preference = ['echarts_py', 'echarts-js', 'd3-js']
    
    # Try each engine in order of preference
    for engine in engine_preference:
        if chart_type in templates[engine]:
            # 如果存在多个chart_name的template，随机返回一个
            chart_names = list(templates[engine][chart_type].keys())
            if chart_names:
                selected_name = random.choice(chart_names)
                template_info = templates[engine][chart_type][selected_name]
                return template_info['engine_type'], template_info['template']
    
    # Try partial matches
    for engine in engine_preference:
        for template_type in templates[engine]:
            if chart_type in template_type or template_type in chart_type:
                # 随机选择一个chart_name
                chart_names = list(templates[engine][template_type].keys())
                if chart_names:
                    selected_name = random.choice(chart_names)
                    template_info = templates[engine][template_type][selected_name]
                    return template_info['engine_type'], template_info['template']
    
    return None, None

def get_template_for_chart_name(chart_name, engine_preference=None):
    """
    Get the template for a specific chart name
    
    Args:
        chart_name: The chart name to look for
        engine_preference: Optional list of engine preferences ['echarts_py', 'echarts-js', 'd3-js']
                          in the order of preference
                          
    Returns:
        tuple of (engine, template) where template is either a module or file path
    """
    global _templates_scanned
    
    # 如果尚未扫描模板，先扫描
    if not _templates_scanned:
        scan_templates()
    
    chart_name = chart_name.lower()
    
    # Try each engine in order of preference
    for engine in templates:
        for chart_type, chart_dict in templates[engine].items():
            if chart_name in chart_dict:
                template_info = chart_dict[chart_name]
                return template_info['engine_type'], template_info['template']
    
    # Try partial matches
    # for engine in engine_preference:
    #     for chart_type, chart_dict in templates[engine].items():
    #         for name in chart_dict:
    #             if chart_name in name or name in chart_name:
    #                 return chart_dict[name]
    
    # 找到重叠最多的匹配
    best_match = None
    max_overlap = 0
    best_result = None
    # print("chart_dict:", templates[engine])
    
    for engine in templates:
        for chart_type, chart_dict in templates[engine].items():
            for name in chart_dict:
                # 计算两个字符串的重叠长度
                overlap = len(set(chart_name) & set(name))
                if overlap > max_overlap:
                    #print("overlap:", overlap)
                    max_overlap = overlap
                    best_match = name
                    #print("best_match:", best_match)
                    template_info = chart_dict[name]
                    best_result = (template_info['engine_type'], template_info['template'])
                    #print("best_result:", best_result)
    if best_result:
        return best_result
    
    return None, None

# 在主模块运行时，扫描模板并打印信息
if __name__ == '__main__':
    scan_templates()
    print("\nAvailable templates:")
    for engine, templates_dict in templates.items():
        print(f"\n{engine}:")
        for chart_type, chart_names_dict in templates_dict.items():
            print(f"  - {chart_type}:")
            for chart_name in chart_names_dict:
                print(f"    * {chart_name}") 
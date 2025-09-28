# -*- coding: utf-8 -*-

"""
ChartPipeline: 完整可视化生成管道
此脚本执行完整的数据可视化生成流程，依次调用各模块实现从数据到最终图表的转换
"""

import os
import json
import argparse
import logging
from datetime import datetime
from importlib import import_module
from pathlib import Path
import random
from concurrent.futures import ProcessPoolExecutor

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ChartPipeline")

# 模块配置
MODULES = [
    {
        "name": "create_index",
        "description": "索引创建模块",
        "input_type": "none",
        "output_type": "none"
    },
    {
        "name": "preprocess",
        "description": "数据预处理模块",
        "input_type": "json",
        "output_type": "json"
    },
    {
        "name": "chart_type_recommender",
        "description": "图表类型推荐模块",
        "input_type": "json",
        "output_type": "json"
    },
    {
        "name": "datafact_generator",
        "description": "数据洞察模块",
        "input_type": "json",
        "output_type": "json"
    },
    {
        "name": "title_generator",
        "description": "标题生成模块",
        "input_type": "json",
        "output_type": "json"
    },
    {
        "name": "color_recommender",
        "description": "色彩推荐模块",
        "input_type": "json",
        "output_type": "json"
    },
    {
        "name": "image_recommender",
        "description": "图像推荐模块",
        "input_type": "json",
        "output_type": "json"
    },
    {
        "name": "all",
        "description": "综合模块(datafact+title+color+image)",
        "input_type": "json",
        "output_type": "json"
    },
    {
        "name": "infographics_generator",
        "description": "信息图表生成模块",
        "input_type": "json",
        "output_type": "json"
    },
    {
        "name": "chart_engine",
        "description": "图表模板实现引擎",
        "input_type": "json",
        "output_type": "svg"
    },
    {
        "name": "title_styler",
        "description": "标题元素生成模块",
        "input_type": "json",
        "output_type": "svg"
    }
]


def run_pipeline(input_path, output_path=None, temp_dir=None, modules_to_run=None, threads=None, chart_name=None):
    """
    执行完整的图表生成管道

    Args:
        input_path (str): 输入数据文件路径(可以是文件或目录)
        output_path (str, optional): 输出文件路径(可以是文件或目录)，如果为None则原地修改
        temp_dir (str, optional): 临时文件目录，默认使用./tmp
        modules_to_run (list, optional): 要运行的模块列表，默认运行所有模块
        threads (int, optional): 处理目录时的并发线程数，仅在input_path为目录时生效
        chart_name (str, optional): 指定图表名称，仅对infographics_generator模块有效
    """
    # try:
    if chart_name is not None:
        output_path = os.path.join(output_path, chart_name)
        import shutil
        shutil.rmtree(output_path, ignore_errors=True)
        os.makedirs(output_path, exist_ok=True)
    print("modules_to_run: ", modules_to_run)

    input_path = Path(input_path)
    output_path = Path(output_path) if output_path else input_path
    temp_dir = Path(temp_dir) if temp_dir else Path("./tmp")

    if input_path.is_dir():
        # 如果指定了输出目录且不同于输入目录，创建输出目录
        if output_path != input_path:
            output_path.mkdir(parents=True, exist_ok=True)

        # 获取输入目录下所有JSON文件
        input_files = list(input_path.glob('*.json'))
        random.shuffle(input_files)  # 随机打乱文件顺序

        if threads and threads > 1:
            # 使用线程池并行处理文件
            with ProcessPoolExecutor(max_workers=threads) as executor:
                futures = []
                for input_file in input_files:
                    # 如果是inplace处理，输出路径就是输入路径
                    if output_path == input_path:
                        output_file = input_file
                    else:
                        # 确保输出文件保持相同的文件名
                        output_file = output_path / input_file.name

                    future = executor.submit(
                        run_single_file,
                        input_path=input_file,
                        output_path=output_file,
                        temp_dir=temp_dir,
                        modules_to_run=modules_to_run,
                        chart_name=chart_name
                    )
                    futures.append(future)

                # 等待所有任务完成并检查结果
                results = [future.result() for future in futures]
                return all(results)
        else:
            # 单线程顺序处理
            success = True
            for input_file in input_files:
                if output_path == input_path:
                    output_file = input_file
                else:
                    output_file = output_path / input_file.name

                success &= run_single_file(
                    input_path=input_file,
                    output_path=output_file,
                    temp_dir=temp_dir,
                    modules_to_run=modules_to_run,
                    chart_name=chart_name
                )
            return success
    else:
        # 单文件处理
        if output_path == input_path:
            output_file = input_path
        else:
            # 如果指定了不同的输出路径，确保它的父目录存在
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_file = output_path

        return run_single_file(
            input_path=input_path,
            output_path=output_file,
            temp_dir=temp_dir,
            modules_to_run=modules_to_run,
            chart_name=chart_name
        )

    # except Exception as e:
    #     logger.error(f"管道执行失败: {str(e)}")
    #     return False

def run_single_file(input_path, output_path, temp_dir=None, modules_to_run=None, chart_name=None):
    """
    处理单个文件的管道逻辑

    Args:
        input_path (Path): 输入JSON文件路径
        output_path (Path): 输出路径
        temp_dir (Path): 临时文件目录，默认为./tmp
        modules_to_run (list): 要运行的模块列表
        chart_name (str, optional): 指定图表名称，仅对infographics_generator模块有效
    """

    # 创建临时目录
    if temp_dir is None:
        temp_dir = Path("./tmp")
    temp_dir.mkdir(parents=True, exist_ok=True)

    # 确保输出目录存在
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # 当前输入文件
    current_input = input_path

    # 确定要运行的模块
    if not modules_to_run:
        modules_to_run = [m["name"] for m in MODULES]

    # 获取最后一个模块的配置
    last_module = [m for m in MODULES if m["name"] in modules_to_run][-1]

    # 根据最后一个模块的输出类型决定最终输出文件的扩展名
    if last_module["name"] in ["chart_engine"]:
        final_output = output_path.with_suffix('.svg')
    else:
        raise ValueError(f"Unknown module: {last_module['name']}")

    # 记录执行过程
    processing_log = []
    # 依次执行各模块
    for i, module_config in enumerate([m for m in MODULES if m["name"] in modules_to_run]):
        module_name = module_config["name"]
        module_desc = module_config["description"]
        # logger.info(f"执行模块 {i+1}/{len(modules_to_run)}: {module_name} - {module_desc}")
        
        if module_name == "chart_engine":
            # 输入是JSON，输出是SVG
            module = import_module(f"modules.{module_name}.{module_name}")
            svg_output = output_path.with_suffix('.svg')
            html_output = output_path.with_suffix('.html')
            if not svg_output.exists():
                module.process(input=str(current_input), output=str(svg_output), chart_name=chart_name, html_output=str(html_output))
            current_input = svg_output  # 更新为SVG文件作为下一个模块的输入
        else: 
            raise ValueError(f"Unknown module: {module_name}")
        
    return True

    # except Exception as e:
    #     logger.error(f"文件处理失败 {input_path}: {str(e)}")
    #     return False

def should_skip_module(module_name: str, output_path: Path) -> bool:
    """检查是否需要跳过模块执行"""
    try:
        if not output_path.exists():
            return False

        # 检查JSON文件中的特定字段
        with open(output_path) as f:
            data = json.load(f)

        skip_conditions = {
            "preprocess": lambda d: "metadata" in d and "data" in d and "variables" in d and "processed" in d,
            "chart_type_recommender": lambda d: "chart_type" in d,
            "datafact_generator": lambda d: "datafacts" in d,
            "title_generator": lambda d: False,#"titles" in d,
            "color_recommender": lambda d: "colors" in d,
            "image_recommender": lambda d: "images" in d
        }

        if module_name in skip_conditions:
            return skip_conditions[module_name](data)

        return False

    except Exception as e:
        logger.warning(f"检查跳过条件时出错: {str(e)}")
        return False

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=str, help='Input json file path', default='./example_data')
    parser.add_argument('--output', type=str, help='Output json file path', default='output')
    parser.add_argument('--temp-dir', type=str, default='tmp')
    parser.add_argument('--modules', type=str, help='Modules to run', default = 'chart_engine')
    parser.add_argument('--threads', type=int, help='Number of threads for directory processing', default=1)
    parser.add_argument('--chart-name', type=str, help='Specific chart name to use for chart_engine')
    
    args = parser.parse_args()
    # 如果没有指定input，从data_resource_path随机选择
    if args.input is None and 'chart_engine' not in args.modules:
        json_files = [f for f in os.listdir(args.input) if f.endswith('.json')]
        if not json_files:
            raise ValueError(f"在 {args.input} 目录下没有找到json文件")
        args.input = os.path.join(args.input, random.choice(json_files))
        print(f"随机选择输入文件: {args.input}")
        args.output = "tmp.json"
        print(f"使用默认输出文件: {args.output}")

    return args

def main():
    args = parse_args()
    modules_to_run = None
    if args.modules:
        modules_to_run = args.modules

    run_pipeline(
        input_path=args.input,
        output_path=args.output,
        temp_dir=args.temp_dir,
        modules_to_run=modules_to_run,
        threads=args.threads,
        chart_name=args.chart_name
    )

if __name__ == "__main__":
    main()

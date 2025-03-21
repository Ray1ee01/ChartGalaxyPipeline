#!/usr/bin/env python
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

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ChartPipeline")

# 模块配置
MODULES = [
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
        "name": "layout_recommender",
        "description": "布局/变体推荐模块",
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
    },
    {
        "name": "layout_optimizer",
        "description": "布局优化模块",
        "input_type": "svg+svg",
        "output_type": "svg"
    }
]


def run_pipeline(input_path, output_path, temp_dir=None, modules_to_run=None):
    """
    执行完整的图表生成管道
    
    Args:
        input_path (str): 输入数据文件路径
        output_path (str): 最终输出SVG文件路径
        temp_dir (str, optional): 临时文件目录，默认使用时间戳创建
        modules_to_run (list, optional): 要运行的模块列表，默认运行所有模块
    
    Returns:
        bool: 执行成功返回True，否则返回False
    """
    try:
        # 创建临时目录
        if not temp_dir:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            temp_dir = f"temp_{timestamp}"
        
        os.makedirs(temp_dir, exist_ok=True)
        logger.info(f"临时文件将存储在: {temp_dir}")
        
        # 复制输入文件到临时目录
        current_input = input_path
        
        # 确定要运行的模块
        if not modules_to_run:
            modules_to_run = [m["name"] for m in MODULES]
        
        # 记录执行过程
        processing_log = []
        
        # 依次执行各模块
        for i, module_config in enumerate([m for m in MODULES if m["name"] in modules_to_run]):
            module_name = module_config["name"]
            module_desc = module_config["description"]
            logger.info(f"执行模块 {i+1}/{len(modules_to_run)}: {module_name} - {module_desc}")
            
            # 为模块创建输出文件路径
            if module_config["output_type"] == "json":
                output_file = os.path.join(temp_dir, f"{i+1}_{module_name}.json")
            else:
                output_file = os.path.join(temp_dir, f"{i+1}_{module_name}.svg")
            
            # 特殊处理layout_optimizer模块
            if module_name == "layout_optimizer":
                chart_svg = os.path.join(temp_dir, f"{i-1}_chart_engine.svg")
                title_svg = os.path.join(temp_dir, f"{i}_title_styler.svg")
                
                # 调用布局优化模块
                start_time = datetime.now()
                try:
                    module = import_module(f"modules.{module_name}")
                    module.process(
                        input_chart=chart_svg,
                        input_title=title_svg,
                        output=output_file
                    )
                    duration_ms = (datetime.now() - start_time).total_seconds() * 1000
                    processing_log.append({
                        "module": module_name,
                        "timestamp": datetime.now().isoformat(),
                        "duration_ms": round(duration_ms, 2)
                    })
                    logger.info(f"模块 {module_name} 完成，耗时: {duration_ms:.2f}ms")
                except Exception as e:
                    logger.error(f"模块 {module_name} 执行失败: {str(e)}")
                    raise
                    
                # 将最终输出复制到指定路径
                with open(output_file, 'r') as f_in:
                    with open(output_path, 'w') as f_out:
                        f_out.write(f_in.read())
                        
                logger.info(f"最终图表已生成: {output_path}")
                
            else:
                # 普通模块处理
                start_time = datetime.now()
                try:
                    module = import_module(f"modules.{module_name}")
                    module.process(input=current_input, output=output_file)
                    current_input = output_file
                    duration_ms = (datetime.now() - start_time).total_seconds() * 1000
                    processing_log.append({
                        "module": module_name,
                        "timestamp": datetime.now().isoformat(),
                        "duration_ms": round(duration_ms, 2)
                    })
                    logger.info(f"模块 {module_name} 完成，耗时: {duration_ms:.2f}ms")
                except Exception as e:
                    logger.error(f"模块 {module_name} 执行失败: {str(e)}")
                    raise
        
        # 保存处理日志
        log_file = os.path.join(temp_dir, "processing_log.json")
        with open(log_file, 'w') as f:
            json.dump(processing_log, f, indent=2)
        
        logger.info(f"管道执行完成，处理日志已保存至: {log_file}")
        return True
        
    except Exception as e:
        logger.error(f"管道执行失败: {str(e)}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ChartPipeline: 数据可视化生成管道")
    parser.add_argument("--input", required=True, help="输入数据文件路径")
    parser.add_argument("--output", required=True, help="输出SVG文件路径")
    parser.add_argument("--temp-dir", help="临时文件目录")
    parser.add_argument("--modules", help="要运行的模块，用逗号分隔")
    
    args = parser.parse_args()
    
    modules_to_run = None
    if args.modules:
        modules_to_run = [m.strip() for m in args.modules.split(",")]
    
    run_pipeline(
        input_path=args.input,
        output_path=args.output,
        temp_dir=args.temp_dir,
        modules_to_run=modules_to_run
    ) 
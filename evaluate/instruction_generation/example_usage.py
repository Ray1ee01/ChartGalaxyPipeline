#!/usr/bin/env python
# -*- coding: utf-8 -*-

from main import process, process_folder
import os

"""
示例：使用新格式处理图表问答对并批量处理文件夹
"""

def single_process_example():
    """单个数据目录处理示例"""
    # 确保图像输出目录存在
    image_dir = "./images"
    os.makedirs(image_dir, exist_ok=True)
    
    # 数据目录
    data_path = "./example_data_path"  # 替换为实际的数据路径
    
    # 自定义指导后缀，确保模型返回格式正确的答案
    custom_suffix = (
        "Your answer must be extremely concise and direct. "
        "Do not include any explanations, reasoning, context, or additional information. "
        "If the answer is a number, provide only that number without units. "
        "If selecting from options, choose exactly one option without any additional words."
    )
    
    # 调用process函数，使用新的JSONL格式
    results = process(
        data_path=data_path,
        output_path="./output.jsonl",  # 使用.jsonl扩展名
        template_path="./template.json",  # 替换为实际的模板路径
        write2disk=True,
        use_model=False,  # 是否使用模型生成问答对
        use_template=True,  # 是否使用模板生成问答对
        convert_to_sharegpt=False,  # 不再需要ShareGPT格式转换
        image_output_dir=image_dir,  # 指定图像输出目录
        custom_instruction_suffix=custom_suffix,  # 添加自定义指导后缀
        include_multiple_choice=True  # 对适当的问题添加多选项
    )
    
    # 统计各类型问题数量
    style_count = sum(1 for item in results if item.get("metadata", {}).get("category") == "style")
    chartvqa_count = sum(1 for item in results if item.get("metadata", {}).get("category") == "chartvqa")
    
    print(f"已生成 {len(results)} 个问答对")
    print(f"其中 style 类型: {style_count} ({style_count/len(results)*100:.1f}%)")
    print(f"chartvqa 类型: {chartvqa_count} ({chartvqa_count/len(results)*100:.1f}%)")
    print(f"查看输出文件: ./output.jsonl")
    print(f"图像已复制到: {image_dir}")

def batch_process_example():
    """批量处理多个数据目录示例"""
    # 自定义指导后缀
    custom_suffix = (
        "Your answer must be extremely concise and direct. "
        "Do not include any explanations, reasoning, context, or additional information. "
        "If the answer is a number, provide only that number without units. "
        "If selecting from options, choose exactly one option without any additional words."
    )
    
    # 批量处理文件夹，指定style类型占50%
    total_pairs = process_folder(
        folder_path="./data_pool",  # 包含多个数据目录的父文件夹
        output_path="./train.jsonl",  # 输出文件
        template_path="./template.json",  # 模板路径
        image_output_dir="./images",  # 图像输出目录
        custom_instruction_suffix=custom_suffix,
        include_multiple_choice=True,
        style_percentage=50  # 设置style类型占50%
    )
    
    print(f"批量处理完成，总共生成了 {total_pairs} 个问答对")
    print(f"输出文件: ./train.jsonl")
    print(f"图像目录: ./images")

if __name__ == "__main__":
    # 选择运行单个处理或批量处理
    # single_process_example()
    batch_process_example() 
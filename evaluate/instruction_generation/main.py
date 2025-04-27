import json
import os
import shutil
import uuid
import random
import string
import glob
from pathlib import Path

from model.factory import QAGeneratorFactory
from template.question_answer_generator import QuestionAnswerGenerator
from model.base import SingleData
from tqdm import tqdm
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("InstructionGeneration.")

def generate_random_id(length=8):
    """生成8位随机字母数字ID"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def process(data_path, output_path="./output.jsonl", template_path=None,
            use_model=True, use_template=True, write2disk=False, num=5, 
            convert_to_sharegpt=False, image_output_dir=None, 
            custom_instruction_suffix=None, include_multiple_choice=False,
            prefix_id=None, append_mode=False):
    all_results = []

    if num > 20:
        logger.warning("可能数量超过了最大可提供数量")

    if use_model:
        model_generating_num = num // 5 * 3
    else:
        model_generating_num = 0
    template_generating_num = max(0, num - model_generating_num)

    # 获取图像路径用于后续处理
    actual_image_path = os.path.join(data_path, "chart.png")
        
    if use_model:
        # 如果data_path是目录，直接传递给SingleData处理
        if os.path.isdir(data_path):
            # 如果未提供独立的image_path，则直接使用data_path作为数据目录
            single_data = SingleData(chart_image=data_path)
        else:
            # 根据data_path是文件进行原始处理
            with open(data_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            tabular_data = data["data"]
            meta_data = data["metadata"]
            single_data = SingleData(tabular_data, meta_data, None)

        factory = QAGeneratorFactory()
        all_generators = factory.get_all_generators(single_data)

        required_generator_count = min(model_generating_num // 2, len(all_generators))
        used_generators = set()
        generator_pool = list(all_generators) 

        successful_count = 0
        with tqdm(total=required_generator_count, desc="Using LLM to generate QA pairs.") as pbar:
            while successful_count < required_generator_count and generator_pool:
                generator = random.choice(generator_pool)

                try:
                    res = generator.generate()
                    if res.error:
                        continue

                    qa_pairs = res.to_dict()["qa_pairs"]
                    if len(qa_pairs) >= 2:
                        selected_pairs = random.sample(qa_pairs, 2)
                        all_results.extend(selected_pairs)
                        successful_count += 1
                        generator_pool.remove(generator)
                        used_generators.add(generator)
                        pbar.update(1)

                except Exception as e:
                    logger.warning(f"Generator error: {e}")
                    continue

    if use_template:
        # 直接传递data_path，不再单独传递image_path
        # 如果data_path是目录，在QuestionAnswerGenerator内部会自动处理
        generator = QuestionAnswerGenerator(
            data_path=data_path,
            template_path=template_path,
            output_path=""
        )
        
        pairs = generator.generate()
        
        # 将问答对分为chartvqa和style两类
        chartvqa_pairs = []
        style_pairs = []
        
        for pair in pairs:
            # 添加模板类别信息
            template_id = pair.get("template", "")
            try:
                template_num = int(template_id.replace("template_", ""))
                if template_num <= 40:
                    pair["category"] = "chartvqa"
                    pair["difficulty"] = "medium"  # 默认难度
                    chartvqa_pairs.append(pair)
                else:
                    pair["category"] = "style"
                    pair["difficulty"] = "easy"  # 默认难度
                    style_pairs.append(pair)
            except ValueError:
                pair["category"] = "chartvqa"  # 默认类别
                pair["difficulty"] = "medium"  # 默认难度
                chartvqa_pairs.append(pair)
            
            pair["question_type"] = "template"
            pair["answer_type"] = "close"
            pair.pop("template", None) 
        
        # 计算需要的问答对数量
        half_count = min(template_generating_num // 2, len(style_pairs) + len(chartvqa_pairs) // 2)
        
        # 确保style类型占50%
        selected_style_count = min(half_count, len(style_pairs))
        selected_chartvqa_count = min(template_generating_num - selected_style_count, len(chartvqa_pairs))
        
        # 如果style不足，从chartvqa中多取一些补足总数
        if selected_style_count < half_count:
            selected_chartvqa_count = min(template_generating_num - selected_style_count, len(chartvqa_pairs))
        
        # 随机采样
        selected_style = random.sample(style_pairs, selected_style_count) if selected_style_count > 0 else []
        selected_chartvqa = random.sample(chartvqa_pairs, selected_chartvqa_count) if selected_chartvqa_count > 0 else []
        
        logger.info(f"已选择 {len(selected_chartvqa)} 个chartvqa问题和 {len(selected_style)} 个style问题")
        
        # 合并结果
        all_results.extend(selected_chartvqa)
        all_results.extend(selected_style)

    # 添加自定义指导后缀
    if custom_instruction_suffix:
        for qa_pair in all_results:
            qa_pair["question"] = f"{qa_pair['question']}\n\n{custom_instruction_suffix}"
    
    # 为选择题答案添加多选项
    if include_multiple_choice:
        for qa_pair in all_results:
            answer = qa_pair["answer"]
            # 为文本型答案添加选项
            if answer not in ["Yes", "No"] and not is_numeric(answer) and len(answer.split()) <= 3:
                # 生成干扰选项
                options = generate_distractor_options(answer)
                options.append(answer)
                # 随机打乱选项
                random.shuffle(options)
                # 只保留最多5个选项
                if len(options) > 5:
                    options = options[:5]
                # 添加选择提示，使用用户提供的格式
                option_text = ", ".join([f"{opt}" for opt in options])
                qa_pair["question"] = (
                    f"{qa_pair['question']}\n\nSelect the correct solution for the preceding question "
                    f"from the options provided: [{option_text}]\n"
                    f"Your answer should be the content of one of the options, rather than the serial number of the option, "
                    f"and should not include any leading preamble words or other content."
                )

    # 生成一个随机ID用于图像，或使用前缀ID
    base_id = prefix_id if prefix_id else "chart"
    image_id = f"{base_id}_{generate_random_id(6)}"
    image_filename = f"{image_id}.png"
    
    # 转换为新的JSONL格式
    formatted_results = []
    
    # 复制图像到输出目录（只复制一次）
    if actual_image_path and image_output_dir:
        # 确保输出目录存在
        os.makedirs(image_output_dir, exist_ok=True)
        
        image_dest_path = os.path.join(image_output_dir, image_filename)
        
        try:
            shutil.copy2(actual_image_path, image_dest_path)
            logger.info(f"图像已复制到: {image_dest_path}")
        except Exception as e:
            logger.error(f"复制图像时出错: {e}")
            return all_results
        
        relative_image_path = f"{os.path.basename(image_output_dir)}/{image_id}.png"
        
        # 为每个QA对生成新格式
        for idx, qa_pair in enumerate(all_results):
            qa_id = f"{image_id}"
            
            # 创建新格式的对象
            formatted_item = {
                "id": qa_id,
                "conversation": [
                    {
                        "role": "human",
                        "content": f"<image>{qa_pair['question']}"
                    },
                    {
                        "role": "assistant",
                        "content": str(qa_pair["answer"])
                    }
                ],
                "metadata": {
                    "source": "chart_data",
                    "category": qa_pair.get("category", "chartvqa"),
                    "difficulty": qa_pair.get("difficulty", "medium")
                },
                "images": [relative_image_path]
            }
            
            formatted_results.append(formatted_item)
    else:
        logger.warning("无法处理图像：缺少图像路径或输出目录")

    if write2disk:
        # 使用JSONL格式写入文件
        mode = 'a' if append_mode else 'w'
        with open(output_path, mode, encoding="utf-8") as f:
            for item in formatted_results:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")

    return formatted_results

def process_folder(folder_path, output_path="./train.jsonl", template_path=None,
                  image_output_dir="./images", custom_instruction_suffix=None,
                  include_multiple_choice=True, style_percentage=50):
    """批量处理文件夹中的所有数据目录
    
    Args:
        folder_path: 包含多个数据目录的父文件夹
        output_path: 输出文件路径
        template_path: 模板文件路径
        image_output_dir: 图像输出目录
        custom_instruction_suffix: 自定义指导后缀
        include_multiple_choice: 是否添加多选项
        style_percentage: style类型问题的百分比(0-100)
    """
    
    # 确保输出目录存在
    os.makedirs(image_output_dir, exist_ok=True)
    
    # 获取folder_path下的所有子目录
    subdirs = [d for d in glob.glob(os.path.join(folder_path, "*")) if os.path.isdir(d)]
    subdirs = subdirs[:30000]
    
    # 如果output_path已存在，先备份
    if os.path.exists(output_path):
        backup_path = f"{output_path}.bak"
        logger.info(f"备份现有文件至 {backup_path}")
        shutil.copy2(output_path, backup_path)
    
    # 清空输出文件
    with open(output_path, "w", encoding="utf-8") as f:
        pass
    
    total_qa_pairs = 0
    
    # 处理每个子目录
    for idx, subdir in enumerate(tqdm(subdirs, desc="处理数据目录")):
        dir_name = os.path.basename(subdir)
        prefix_id = f"chart_{dir_name}"
        
        logger.info(f"处理目录 [{idx+1}/{len(subdirs)}]: {subdir}")
        
        try:
            # 处理当前目录的问答对
            results = process(
                data_path=subdir,
                output_path=output_path,  # 直接指定输出路径
                template_path=template_path,
                write2disk=True,  # 设置为True，让process负责写入
                use_model=False,
                use_template=True,
                convert_to_sharegpt=False,
                image_output_dir=image_output_dir,
                custom_instruction_suffix=custom_instruction_suffix,
                include_multiple_choice=include_multiple_choice,
                prefix_id=prefix_id,
                append_mode=True  # 始终追加模式
            )
            
            logger.info(f"已为 {subdir} 生成并追加 {len(results)} 个问答对到 {output_path}")
            total_qa_pairs += len(results)
            
        except Exception as e:
            logger.error(f"处理 {subdir} 时出错: {e}")
    
    logger.info(f"批量处理完成。总共生成 {total_qa_pairs} 个问答对，保存至 {output_path}")
    return total_qa_pairs

def is_numeric(value):
    """判断字符串是否为数值"""
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False

def generate_distractor_options(correct_answer, num_distractors=4):
    """为选择题生成干扰选项"""
    # 这里是一些图表类型的备选项，可以根据实际需求修改
    chart_types = [
        "bar chart", "line chart", "pie chart", "scatter plot", 
        "area chart", "radar chart", "box plot", "histogram",
        "heatmap", "waterfall chart", "bubble chart", "candlestick chart",
        "sankey diagram", "treemap", "word cloud", "stem-and-leaf plot",
        "violin plot", "choropleth map", "gantt chart", "sunburst chart",
        "bivariate histogram", "density plot", "contour plot", "funnel chart"
    ]
    
    # 数据指标常见的干扰选项
    data_metrics = [
        "mean", "median", "mode", "variance", "standard deviation",
        "maximum", "minimum", "range", "percentile", "quartile",
        "correlation", "regression", "trend", "growth rate", "decline rate",
        "count", "sum", "average", "distribution", "frequency"
    ]
    
    # 数据领域常见的干扰选项
    data_domains = [
        "sales", "revenue", "profit", "loss", "cost",
        "income", "expense", "budget", "forecast", "projection",
        "demographics", "statistics", "analytics", "metrics", "indicators",
        "population", "sample", "segment", "category", "group"
    ]
    
    # 根据正确答案选择合适的干扰项集合
    if any(chart_type in correct_answer.lower() for chart_type in ["chart", "plot", "graph", "diagram", "map"]):
        options = chart_types
    elif any(metric in correct_answer.lower() for metric in ["mean", "average", "median", "max", "min"]):
        options = data_metrics
    else:
        options = data_domains
    
    # 过滤掉包含正确答案的选项
    filtered_options = [opt for opt in options if correct_answer.lower() not in opt.lower() and opt.lower() not in correct_answer.lower()]
    
    # 随机选择干扰选项
    distractors = random.sample(filtered_options, min(num_distractors, len(filtered_options)))
    
    return distractors

if __name__ == "__main__":
    # 单个数据目录处理示例
    # process(
    #     data_path="./example_data_path",  # 指向包含所需文件的目录
    #     output_path="./output.jsonl",
    #     template_path="/home/lizhen/ChartPipeline/evaluate/instruction_generation/example.json",
    #     write2disk=True,
    #     use_model=False,
    #     convert_to_sharegpt=True,
    #     image_output_dir="./image",
    #     custom_instruction_suffix="Please provide a direct answer without any explanations or additional text.",
    #     include_multiple_choice=True
    # )
    
    # 批量处理示例
    process_folder(
        folder_path="/data/lizhen/resources/generated/0425",  # 包含多个数据目录的父文件夹
        output_path="./train.jsonl",
        template_path="./example.json",
        image_output_dir="./images",
        custom_instruction_suffix="Please provide a direct answer without any explanations or additional text.",
        include_multiple_choice=True,
        style_percentage=50  # 设置style类型问题比例为50%
    )
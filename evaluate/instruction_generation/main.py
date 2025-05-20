import json
import os
import shutil
import uuid
import random
import string
import glob
import base64
from io import BytesIO
from pathlib import Path
import concurrent.futures
import threading
import re

from model.factory import QAGeneratorFactory
from template.question_answer_generator import QuestionAnswerGenerator
from model.base import SingleData
from tqdm import tqdm
import logging
from PIL import Image

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("InstructionGeneration.")

# 文件写入锁，确保多线程写入安全
file_lock = threading.Lock()

def generate_random_id(length=4):
    """生成简短的随机ID"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def process(data_path, output_path="./output.jsonl", template_path=None,
            source="template", write2disk=False, num=20,
            unanswerable=False,
            image_output_dir=None, prefix_id=None, append_mode=False):
    """
    处理单个数据目录，生成问答对

    Args:
        data_path: 数据目录路径
        output_path: 输出文件路径
        template_path: 模板文件路径，仅在source为template时使用
        source: 问题生成来源，"model"或"template"
        write2disk: 是否写入磁盘
        num: 生成的问题数量
        image_output_dir: 图像输出目录
        # Removed custom_instruction_suffix description
        include_multiple_choice: 是否添加多选项
        prefix_id: 图像ID前缀
        append_mode: 是否以追加模式写入文件

    Returns:
        生成的问答对列表
    """
    all_results = []

    if num > 20:
        logger.warning("可能数量超过了最大可提供数量")

    # 获取图像路径用于后续处理
    actual_image_path = os.path.join(data_path, "chart.png")

    # 根据来源生成问答对
    if source == "model":
        logger.info(f"使用模型生成问答对，目标数量: {num}")
        single_data = SingleData(chart_image=data_path)
        factory = QAGeneratorFactory()
        all_generators = factory.get_all_generators(single_data)

        # 计算需要的生成器数量
        generator_pool = list(all_generators)
        required_generator_count = num

        # 使用不同生成器生成问题
        successful_count = 0
        with tqdm(total=required_generator_count, desc="使用LLM生成问答对") as pbar:
            while successful_count < required_generator_count and generator_pool:
                generator = random.choice(generator_pool)
                print(f"generator: {generator}")
                try:
                    res = generator.generate(unanswerable)
                    if res.error:
                        continue

                    qa_pairs = res.to_dict()["qa_pairs"]
                    for qa in qa_pairs:
                        qa["question"] = qa["full_question"]

                    selected_pairs = qa_pairs
                    if len(qa_pairs) >= 5:
                        selected_pairs = random.sample(qa_pairs, 5)
                    all_results.extend(selected_pairs)

                    successful_count += len(qa_pairs)
                    generator_pool.remove(generator)
                    pbar.update(1)
                except Exception as e:
                    logger.warning(f"生成器错误: {e}")
                    continue

    elif source == "template":
        logger.info(f"使用模板生成问答对，目标数量: {num}")
        if not template_path:
            logger.error("使用模板生成问题时必须提供template_path")
            return []

        generator = QuestionAnswerGenerator(
            data_path=data_path,
            template_path=template_path,
            output_path=""
        )

        template_pairs = generator.generate()
        data_understanding_pairs = []
        visual_understanding_pairs = []
        composition_understanding_pairs = []
        # 分类问题
        for pair in template_pairs:
            category = pair.get("category", "data understanding")
            pair["question_type"] = pair.get("type", "unknown")
            pair.pop("template", None)

            if category == "composite understanding":
                composition_understanding_pairs.append(pair)
            elif category == "visual understanding":
                visual_understanding_pairs.append(pair)
            else:
                data_understanding_pairs.append(pair)

        # 计算每个类别需要的数量
        k = max(2, num // 4)
        print(f"k: {k}")
        
        # 优先从composition understanding选择k个
        selected_composition_count = num
        selected_composition = random.sample(composition_understanding_pairs, selected_composition_count) if selected_composition_count > 0 else []
        
        # 从visual understanding选择k个
        selected_visual_count = 0#random.randint(1, 2)
        selected_visual = random.sample(visual_understanding_pairs, selected_visual_count) if selected_visual_count > 0 else []
        
        # 剩余的从data understanding中选择
        remaining_count = 0#num - selected_composition_count - selected_visual_count
        selected_data_count = min(remaining_count, len(data_understanding_pairs))
        selected_data = random.sample(data_understanding_pairs, selected_data_count) if selected_data_count > 0 else []

        logger.info(f"从模板中选择了 {len(selected_composition)} 个 Composition Understanding 问题, "
                   f"{len(selected_visual)} 个 Visual Understanding 问题, "
                   f"和 {len(selected_data)} 个 Data Understanding 问题")


        all_results.extend(selected_composition)
        all_results.extend(selected_data)
        all_results.extend(selected_visual)

        # 确保所有选择类型的问题都有明确的回答指令
        for qa_pair in all_results:
            question = qa_pair["question"]

            # 如果包含选项但未包含答案指令，添加适当的指令
            if (has_existing_options(question) or re.search(r'Select one\s*:\s*\[.*?\]', question)) and \
               not any(phrase in question for phrase in ["Answer with the letter", "Select the correct", "Provide the answer"]):

                if re.search(r"[A-D]\s*\)", question) or re.search(r"[A-D]\s*\.", question):
                    qa_pair["question"] = f"{question}\n\nAnswer with the letter of the correct option only."
                elif "Select one:" in question or "Select one :" in question:
                    qa_pair["question"] = f"{question}\n\nSelect the correct answer from the options."
                else:
                    qa_pair["question"] = f"{question}\n\nProvide the answer directly."

    else:
        logger.error(f"不支持的问题来源: {source}")
        return []

    # 没有生成任何问题，直接返回
    if not all_results:
        logger.warning(f"未能生成任何问题")
        return []
    
    if num <= 3:
        all_results = all_results[:num]

    # 生成图像ID并准备结果
    base_id = prefix_id if prefix_id else "c"
    image_id = f"{base_id}{generate_random_id(4)}"
    image_filename = f"{image_id}.png"
    formatted_results = []

    # 复制图像并生成格式化结果
    if actual_image_path and image_output_dir:
        # 确保输出目录存在
        os.makedirs(image_output_dir, exist_ok=True)
        image_dest_path = os.path.join(image_output_dir, image_filename)

        try:
            shutil.copy2(actual_image_path, image_dest_path)
            logger.info(f"图像已复制到: {image_dest_path}")
        except Exception as e:
            logger.error(f"复制图像时出错: {e}")
            return all_results # Return results generated so far before error

        relative_image_path = f"{os.path.basename(image_output_dir)}/{image_id}.png"

        # 为每个QA对生成格式化结果
        for idx, qa_pair in enumerate(all_results):
            qa_id = f"{image_id}_{idx}"
            question_content = qa_pair["question"]
            images_list = [relative_image_path]

            # 处理额外图像
            # 返回的 image 从 tuple 变为 list[tuple], 表示一个问题中包含的多个 icons
            if "image" in qa_pair and qa_pair["image"] is not None:
                values = [] # 存放多个 icon 对应数据
                base64_datas = [] # 存放多个 icon

                for single_image_tuple in qa_pair["image"]:
                    values.append(single_image_tuple[0])
                    base64_datas.append(single_image_tuple[1])

                has_options = has_existing_options(question_content)
                original_content = question_content

                if has_options:
                    # 选项格式化避免替换
                    question_parts = question_content.split("\n\n")
                    options_section = None

                    # 找出选项部分
                    for part in question_parts:
                        if has_options_pattern(part):
                            options_section = part
                            break
                    
                    # 替换每个 icon 数据
                    for value in values:
                        # 如果找到选项部分且值在选项中，避免替换
                        if options_section and is_in_options_section(question_content, value, options_section):
                            logger.warning(f"检测到值 '{value}' 在选项中，避免替换为<image>标签")
                            # 仅替换选项之外的部分
                            for i, part in enumerate(question_parts):
                                if part != options_section:
                                    question_parts[i] = part.replace(value, "<image>", 1)
                            question_content = "\n\n".join(question_parts) # Use single newline join
                        else:
                            # 选项部分不包含该值，可以全局替换（仅一次）
                            question_content = question_content.replace(value, "<image>", 1)
                else:
                    # 没有选项，可以直接替换（仅一次）
                    for value in values:
                        question_content = question_content.replace(value, "<image>", 1)

                # 检查是否实际替换了<image>标签
                if question_content != original_content:
                    # 生成额外图像的文件名
                    for image_idx, value in enumerate(values):
                        base64_data = base64_datas[image_idx]
                        
                        extra_image_filename = f"{image_id}_{idx}_{image_idx}_extra.png"
                        extra_image_path = os.path.join(image_output_dir, extra_image_filename)

                        # 从base64保存图像到文件
                        try:
                            # 打印数据前几个字符用于调试
                            logger.info(f"Base64数据前20个字符: {base64_data[:20]}...")

                            # 检查数据是否为标准base64格式
                            if ',' in base64_data:
                                # 可能是data URI格式 (data:image/png;base64,...)
                                header, base64_data = base64_data.split(',', 1)
                                logger.info(f"检测到data URI格式: {header}")

                            # 修复base64填充问题
                            base64_data = base64_data.strip()
                            # 添加必要的填充
                            missing_padding = len(base64_data) % 4
                            if missing_padding:
                                base64_data += '=' * (4 - missing_padding)

                            # 尝试解码base64数据
                            image_data = base64.b64decode(base64_data)

                            # 检查数据是否为有效的图像格式
                            if len(image_data) < 100:
                                raise ValueError(f"解码后数据过小({len(image_data)}字节)，可能不是有效图像")

                            # 尝试直接写入文件
                            with open(extra_image_path, 'wb') as f:
                                f.write(image_data)

                            # 验证文件是否为有效图像
                            try:
                                with Image.open(extra_image_path) as img:
                                    img.verify() # Verify headers
                                    # Re-open to get properties after verify
                                    with Image.open(extra_image_path) as img_reopened:
                                        logger.info(f"验证图像成功: {img_reopened.format}, 尺寸: {img_reopened.size}")

                                # 添加到图像列表
                                relative_extra_image_path = f"{os.path.basename(image_output_dir)}/{extra_image_filename}"
                                images_list.append(relative_extra_image_path)
                                logger.info(f"额外图像已保存到: {extra_image_path}")
                            except Exception as img_err:
                                logger.error(f"保存的文件不是有效图像: {img_err}")
                                # 删除无效图像文件
                                if os.path.exists(extra_image_path):
                                    os.remove(extra_image_path)
                                raise ValueError(f"无法验证图像格式: {img_err}")

                        except Exception as e:
                            logger.error(f"保存额外图像时出错: {e}")
                            # 记录详细错误信息以便调试
                            import traceback
                            logger.error(f"错误详情: {traceback.format_exc()}")

                            # 如果图像处理失败，继续处理问题而不添加额外图像
                            logger.info(f"将继续处理问题，但不添加额外图像")
                else:
                    logger.info(f"没有替换<image>标签，跳过额外图像处理")

            # 创建格式化项（无论是否有额外图像）
            formatted_item = {
                "id": qa_id,
                "conversation": [
                    {
                        "role": "human",
                        "content": f"<image>{question_content}"
                    },
                    {
                        "role": "assistant",
                        "content": str(qa_pair["answer"])
                    }
                ],
                "metadata": {
                    "source": "chart_data",
                    "category": qa_pair.get("category", "data understanding"),
                    "difficulty": qa_pair.get("difficulty", "medium"),
                    "type": qa_pair.get("question_type", "unknown"),
                    "subcategory": qa_pair.get("subcategory", "general")
                },
                "images": images_list
            }

            formatted_results.append(formatted_item)
    else:
        logger.warning("无法处理图像：缺少图像路径或输出目录")

    # 写入磁盘
    if write2disk and formatted_results:
        with file_lock:
            mode = 'a' if append_mode else 'w'
            with open(output_path, mode, encoding="utf-8") as f:
                for item in formatted_results:
                    f.write(json.dumps(item, ensure_ascii=False) + "\n")

    return formatted_results

def process_single_dir(subdir, output_path, template_path, image_output_dir,
                       include_multiple_choice, progress_counter,
                       unanswerable = False,
                       source="template", num_questions=8):
    """处理单个目录的函数，用于多线程调用

    Args:
        subdir: 数据目录路径
        output_path: 输出文件路径
        template_path: 模板文件路径
        image_output_dir: 图像输出目录
        # Removed custom_instruction_suffix description
        include_multiple_choice: 是否添加多选项
        progress_counter: 进度计数器
        source: 问题来源，"model"或"template"
        num_questions: 每个图表生成的问题数量

    Returns:
        生成的问答对数量
    """
    dir_name = os.path.basename(subdir)
    # 使用更简短的前缀ID
    prefix_id = f"c{dir_name[:3]}"

    # 处理当前目录的问答对
    results = process(
        data_path=subdir,
        output_path=output_path,
        template_path=template_path,
        write2disk=True,
        source=source,
        image_output_dir=image_output_dir,
        unanswerable=unanswerable,
        prefix_id=prefix_id,
        append_mode=True,
        num=num_questions
    )

    # 更新进度
    with progress_counter['lock']:
        progress_counter['count'] += 1
        current = progress_counter['count']
        total = progress_counter['total']
        logger.info(f"进度 [{current}/{total}] - 已为 {subdir} 生成 {len(results)} 个问答对")

    return len(results)


def process_folder(folder_path, output_path="./train.jsonl", template_path=None,
                  image_output_dir="./images", # Removed custom_instruction_suffix
                  unanswerable=False,
                  include_multiple_choice=True, num_threads=10, source="template",
                  num_questions=8):
    """批量处理文件夹中的所有数据目录，支持多线程处理

    Args:
        folder_path: 包含多个数据目录的父文件夹
        output_path: 输出文件路径
        template_path: 模板文件路径
        image_output_dir: 图像输出目录
        # Removed custom_instruction_suffix description
        include_multiple_choice: 是否添加多选项
        num_threads: 并行处理的线程数量
        source: 问题来源，"model"或"template"
        num_questions: 每个图表生成的问题数量
    """

    if os.path.exists(output_path):
        os.remove(output_path)
    if os.path.exists(image_output_dir):
        shutil.rmtree(image_output_dir)

    os.makedirs(image_output_dir, exist_ok=True)

    # 获取folder_path下的所有子目录
    print(f"folder_path: {folder_path}")
    subdirs = [d for d in glob.glob(os.path.join(folder_path, "*")) if os.path.isdir(d)]

    # 如果output_path已存在，先备份
    if os.path.exists(output_path):
        backup_path = f"{output_path}.bak"
        logger.info(f"备份现有文件至 {backup_path}")
        shutil.copy2(output_path, backup_path)

    # 清空输出文件
    with open(output_path, "w", encoding="utf-8") as f:
        pass

    # 进度计数器
    progress_counter = {
        'count': 0,
        'total': len(subdirs),
        'lock': threading.Lock()
    }

    # 使用线程池并行处理
    total_qa_pairs = 0
    logger.info(f"开始并行处理，使用 {num_threads} 个线程，生成源为：{source}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        # 提交所有任务
        future_to_dir = {
            executor.submit(
                process_single_dir,
                subdir,
                output_path,
                template_path,
                image_output_dir,
                # Removed custom_instruction_suffix argument
                include_multiple_choice,
                progress_counter,
                unanswerable,
                source,
                num_questions
            ): subdir for subdir in subdirs
        }

        # 获取结果
        for future in concurrent.futures.as_completed(future_to_dir):
            subdir = future_to_dir[future]
            try:
                result_count = future.result()
                total_qa_pairs += result_count
            except Exception as e:
                logger.error(f"处理 {subdir} 时发生异常: {e}")

    logger.info(f"批量处理完成。总共生成 {total_qa_pairs} 个问答对，保存至 {output_path}")
    return total_qa_pairs

def is_numeric(value):
    """判断字符串是否为数值"""
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False

def has_existing_options(question):
    """
    检查问题是否已经包含选项

    Args:
        question: 问题文本

    Returns:
        bool: 如果问题已包含选项则返回True，否则返回False
    """
    # 检查常见的选项标记
    option_indicators = [
        "Select", "Choose", "Options:",
        "A)", "B)", "C)", "D)",
        "[A]", "[B]", "[C]", "[D]",
        "A.", "B.", "C.", "D.",
        "(A)", "(B)", "(C)", "(D)"
    ]

    # 检查问题是否包含任一选项标记
    for indicator in option_indicators:
        if indicator in question:
            return True

    # 正则表达式匹配常见的选项格式
    option_patterns = [
        r"[A-D]\s*[.:]", # 匹配 A: B: C: D: 或 A. B. C. D.
        r"\([A-D]\)", # 匹配 (A) (B) (C) (D)
        r"\[[A-D]\]", # 匹配 [A] [B] [C] [D]
        r"Option\s+[A-D]" # 匹配 Option A Option B 等
    ]

    for pattern in option_patterns:
        if re.search(pattern, question):
            return True

    return False

def has_options_pattern(text):
    """
    检查文本是否包含选项模式

    Args:
        text: 要检查的文本

    Returns:
        bool: 如果包含选项模式则返回True
    """
    option_patterns = [
        r"[A-D]\s*\)", # A) B) C) D)
        r"[A-D]\s*\.", # A. B. C. D.
        r"\([A-D]\)", # (A) (B) (C) (D)
        r"\[[A-D]\]", # [A] [B] [C] [D]
        r"Option\s+[A-D]" # Option A Option B
    ]

    for pattern in option_patterns:
        if re.search(pattern, text):
            return True

    # 检查是否包含选择列表
    select_patterns = [
        r"Select one",
        r"Select from",
        r"Choose from",
        r"\[.+,.+,.+\]"
    ]

    for pattern in select_patterns:
        if re.search(pattern, text):
            return True

    return False

def is_in_options_section(text, value, options_text):
    """
    判断指定的值是否在选项文本中

    Args:
        text: 完整的问题文本
        value: 要检查的值
        options_text: 选项文本部分

    Returns:
        bool: 如果值在选项中则返回True
    """
    # 选项文本中找到该值
    if value in options_text:
        return True

    # 检查是否在选项的特定格式内
    option_patterns = [
        rf"[A-D]\s*\)\s*.*{re.escape(value)}.*",  # A) 包含value的文本
        rf"[A-D]\s*\.\s*.*{re.escape(value)}.*",  # A. 包含value的文本
        rf"\([A-D]\)\s*.*{re.escape(value)}.*",   # (A) 包含value的文本
    ]

    for pattern in option_patterns:
        if re.search(pattern, options_text):
            return True

    return False

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='处理数据生成问答对')
    parser.add_argument('--mode', type=str, default='train', choices=['train', 'test'],
                      help='运行模式:train或test')
    parser.add_argument('--source', type=str, default='template', choices=['model', 'template'],
                      help='问题生成来源: model(基于LLM) 或 template(基于模板)')
    parser.add_argument('--num', type=int, default=8,
                      help='每个图表生成的问题数量')
    parser.add_argument('--threads', type=int, default=1,
                      help='并行处理的线程数量')
    parser.add_argument('--unanswerable', action='store_true',
                      help='是否生成不可回答的问题')
    parser.add_argument('--template_path', type=str, default='./example.json',
                      help='模板文件路径，仅当source=template时需要')
    # Removed custom_instruction_suffix argument
    args = parser.parse_args()

    if args.mode == 'train':
        process_folder(
            #folder_path="/data/lizhen/resources/data/instruction/realdata",
            folder_path="/data/lizhen/resources/data/instruction/syndata",
            #folder_path="/data/lizhen/resources/generated/0428",  # 包含多个数据目录的父文件夹
            output_path="./train.jsonl",
            template_path=args.template_path if args.source == "template" else None,
            image_output_dir="./train_images",
            # Removed custom_instruction_suffix argument
            include_multiple_choice=True,
            num_threads=args.threads,
            source=args.source,
            num_questions=args.num,
            unanswerable=args.unanswerable
        )
    else:
        process_folder(
            folder_path="/data/lizhen/resources/data/instruction/finaltest",  # 测试数据目录
            # 在36使用/data1/lizhen/resources/0428_test"
            #folder_path="./tmp",
            output_path="./test_supp.jsonl",
            template_path=args.template_path if args.source == "template" else None,
            image_output_dir="./test_images",
            include_multiple_choice=True,
            num_threads=args.threads,
            source=args.source,
            num_questions=args.num,
            unanswerable=args.unanswerable
        )
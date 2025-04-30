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
            use_model=True, use_template=True, write2disk=False, num=20, 
            convert_to_sharegpt=False, image_output_dir=None, 
            custom_instruction_suffix=None, include_multiple_choice=False,
            prefix_id=None, append_mode=False):
    all_results = []

    if num > 20:
        logger.warning("可能数量超过了最大可提供数量")

    use_model = True
    if use_model:
        model_generating_num = 3
    else:
        model_generating_num = 0
    template_generating_num = max(0, num - model_generating_num)

    # 获取图像路径用于后续处理
    actual_image_path = os.path.join(data_path, "chart.png")
        
    if use_model:
        single_data = SingleData(chart_image=data_path)
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
        generator = QuestionAnswerGenerator(
            data_path=data_path,
            template_path=template_path,
            output_path=""
        )
        
        template_pairs = generator.generate()
        data_understanding_pairs = []
        visual_understanding_pairs = []

        for pair in template_pairs:
            category = pair.get("category", "data understanding")
            pair["question_type"] = pair.get("type", "unknown")
            pair.pop("template", None)

            if category == "visual understanding":
                 visual_understanding_pairs.append(pair)
            else:
                 data_understanding_pairs.append(pair)

        target_template_count = template_generating_num
        half_count = min(target_template_count // 2, len(visual_understanding_pairs) + len(data_understanding_pairs) // 2)

        selected_visual_count = min(half_count, len(visual_understanding_pairs))
        selected_data_count = min(target_template_count - selected_visual_count, len(data_understanding_pairs))

        # 如果 visual understanding 不足，从 data understanding 中补充
        if selected_visual_count < half_count:
             selected_data_count = min(target_template_count - selected_visual_count, len(data_understanding_pairs))

        # 随机采样
        selected_visual = random.sample(visual_understanding_pairs, selected_visual_count) if selected_visual_count > 0 else []
        selected_data = random.sample(data_understanding_pairs, selected_data_count) if selected_data_count > 0 else []

        logger.info(f"从模板中选择了 {len(selected_data)} 个 Data Understanding 问题和 {len(selected_visual)} 个 Visual Understanding 问题")

        # 合并模板结果
        all_results.extend(selected_data)
        all_results.extend(selected_visual)

    # 添加自定义指导后缀
    if custom_instruction_suffix:
        for qa_pair in all_results:
            # 检查问题是否已经包含类似指令
            if custom_instruction_suffix not in qa_pair["question"]:
                qa_pair["question"] = f"{qa_pair['question']}\n\n{custom_instruction_suffix}"
    
    # 处理样式问题，明确描述
    for qa_pair in all_results:
        if qa_pair.get("category") == "style":
            qa_pair["question"] = clarify_style_question(qa_pair["question"])
        
        # 移除所有选择题问题中的冗余指令
        if has_existing_options(qa_pair["question"]) or "Select one:" in qa_pair["question"]:
            # 统一选择题格式并获取更新后的答案
            standardized_question, updated_answer = standardize_multiple_choice_format(qa_pair["question"], qa_pair["answer"])
            qa_pair["question"] = standardized_question
            qa_pair["answer"] = updated_answer
    
    # 为选择题答案添加提示
    if include_multiple_choice:
        multiple_choice_questions = []
        for qa_pair in all_results:
            answer = qa_pair["answer"]
            question = qa_pair["question"]
            
            # 检查问题是否已经包含选项
            if has_existing_options(question):
                # 如果已包含选项，统一选择题格式
                qa_pair["question"] = standardize_multiple_choice_format(question, answer)[0]
                continue
            
            # 只为简短的文本型答案添加选项提示
            if answer not in ["Yes", "No"] and not is_numeric(answer) and len(answer.split()) <= 3:
                # 添加选择提示，但不生成具体选项
                qa_pair["question"] = (
                    f"{question}\n\nFor this question, we need multiple choice options. "
                    f"Please provide 4 options including '{answer}' as the correct answer. "
                    f"Please display options in a format like: A) Option1, B) Option2, etc."
                )
                # 存储需要向LLM请求生成选项的问题
                multiple_choice_questions.append(qa_pair)
        
        # 如果有需要生成选项的问题，可以批量发送给LLM处理
        if multiple_choice_questions:
            logger.info(f"有 {len(multiple_choice_questions)} 个问题需要LLM生成选项")
            # 调用函数生成选项
            updated_questions = generate_multiple_choice_options(multiple_choice_questions, data_path)
            
            # 更新原始问题列表中的问题
            for updated_q in updated_questions:
                for i, q in enumerate(all_results):
                    if q["question"].split("\n\nFor this question")[0] == updated_q["question"].split("\n\n")[0]:
                        all_results[i] = updated_q
                        break

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

    # Post-processing: ensure no conflicting instructions remain
    for qa_pair in all_results:
        question = qa_pair["question"]
        
        # If question contains "Answer with the letter" instruction, ensure no "Provide a direct answer" instruction remains
        if "Answer with the letter" in question:
            lines = question.split("\n\n")
            cleaned_lines = []
            
            for line in lines:
                if not any(phrase in line for phrase in ["Provide a direct answer", "Please provide a direct answer"]):
                    cleaned_lines.append(line)
            
            qa_pair["question"] = "\n\n".join(cleaned_lines)

    # 生成一个简短的随机ID用于图像
    base_id = prefix_id if prefix_id else "c"
    image_id = f"{base_id}{generate_random_id(4)}"
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
            # 使用更简短的ID
            qa_id = f"{image_id}_{idx}"
            question_content = qa_pair["question"]
            images_list = [relative_image_path]
            
            # 处理额外图像：如果question_pair中image属性存在并且不为None
            if "image" in qa_pair and qa_pair["image"] is not None:
                value, base64_data = qa_pair["image"]
                
                # 检查是否包含选项
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
                    
                    # 如果找到选项部分且值在选项中，避免替换
                    if options_section and is_in_options_section(question_content, value, options_section):
                        logger.warning(f"检测到值 '{value}' 在选项中，避免替换为<image>标签")
                        # 仅替换选项之外的部分
                        for i, part in enumerate(question_parts):
                            if part != options_section:
                                question_parts[i] = part.replace(value, "<image>")
                        question_content = "\n\n".join(question_parts)
                    else:
                        # 选项部分不包含该值，可以全局替换
                        question_content = question_content.replace(value, "<image>")
                else:
                    # 没有选项，可以直接替换
                    question_content = question_content.replace(value, "<image>")
                
                # 检查是否实际替换了<image>标签
                if question_content != original_content:
                    # 生成额外图像的文件名
                    extra_image_filename = f"{image_id}_{idx}_extra.png"
                    extra_image_path = os.path.join(image_output_dir, extra_image_filename)
                    
                    # 从base64保存图像到文件
                    try:
                        # 打印数据前几个字符用于调试(避免打印整个数据)
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
                                img.verify()
                                logger.info(f"验证图像成功: {img.format}, 尺寸: {img.size}")
                            
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
            
            # 创建新格式的对象
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

    if write2disk:
        # 使用线程锁确保安全写入
        with file_lock:
            # 使用JSONL格式写入文件
            mode = 'a' if append_mode else 'w'
            with open(output_path, mode, encoding="utf-8") as f:
                for item in formatted_results:
                    f.write(json.dumps(item, ensure_ascii=False) + "\n")

    return formatted_results

def process_single_dir(subdir, output_path, template_path, image_output_dir, 
                       custom_instruction_suffix, include_multiple_choice, progress_counter):
    """处理单个目录的函数，用于多线程调用
    
    Args:
        subdir: 数据目录路径
        output_path: 输出文件路径
        template_path: 模板文件路径
        image_output_dir: 图像输出目录
        custom_instruction_suffix: 自定义指导后缀
        include_multiple_choice: 是否添加多选项
        progress_counter: 进度计数器
        
    Returns:
        生成的问答对数量
    """
    dir_name = os.path.basename(subdir)
    # 使用更简短的前缀ID
    prefix_id = f"c{dir_name[:3]}"
    
    try:
        # 处理当前目录的问答对
        results = process(
            data_path=subdir,
            output_path=output_path,
            template_path=template_path,
            write2disk=True,
            use_model=True,
            use_template=True,
            convert_to_sharegpt=False,
            image_output_dir=image_output_dir,
            custom_instruction_suffix=custom_instruction_suffix,
            include_multiple_choice=include_multiple_choice,
            prefix_id=prefix_id,
            append_mode=True,
            num=12
        )
        
        # 更新进度
        with progress_counter['lock']:
            progress_counter['count'] += 1
            current = progress_counter['count']
            total = progress_counter['total']
            logger.info(f"进度 [{current}/{total}] - 已为 {subdir} 生成 {len(results)} 个问答对")
        
        return len(results)
        
    except Exception as e:
        logger.error(f"处理 {subdir} 时出错: {e}")
        return 0

def process_folder(folder_path, output_path="./train.jsonl", template_path=None,
                  image_output_dir="./images", custom_instruction_suffix=None,
                  include_multiple_choice=True, style_percentage=50, num_threads=10):
    """批量处理文件夹中的所有数据目录，支持多线程处理
    
    Args:
        folder_path: 包含多个数据目录的父文件夹
        output_path: 输出文件路径
        template_path: 模板文件路径
        image_output_dir: 图像输出目录
        custom_instruction_suffix: 自定义指导后缀
        include_multiple_choice: 是否添加多选项
        style_percentage: style类型问题的百分比(0-100)
        num_threads: 并行处理的线程数量
    """
    
    # 确保输出目录存在
    os.makedirs(image_output_dir, exist_ok=True)
    
    # 获取folder_path下的所有子目录
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
    logger.info(f"开始并行处理，使用 {num_threads} 个线程")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        # 提交所有任务
        future_to_dir = {
            executor.submit(
                process_single_dir, 
                subdir, 
                output_path, 
                template_path, 
                image_output_dir, 
                custom_instruction_suffix, 
                include_multiple_choice, 
                progress_counter
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

def standardize_multiple_choice_format(question, answer):
    """Standardize multiple choice question format and update answer if needed"""
    parts = question.split("\n\n")
    question_text = parts[0]
    
    # Remove redundant instructions
    redundant_phrases = [
        "Provide a direct answer.",
        "Please provide a direct answer.",
        "without any explanations or additional text.",
        "Provide a direct answer",
        "Please provide a direct answer",
        "without any explanations"
    ]
    
    for phrase in redundant_phrases:
        question_text = question_text.replace(phrase, "").strip()
    
    # Fix duplicate text
    if "(chart title, subtitle) (chart title, subtitle)" in question_text:
        question_text = question_text.replace("(chart title, subtitle) (chart title, subtitle)", "(chart title, subtitle)")
    
    # Find options section
    options_part = None
    for part in parts[1:]:
        if has_options_pattern(part):
            options_part = part
            break
    
    # Default to original answer
    updated_answer = answer
    
    if not options_part:
        # Handle "Select one:" format
        if "Select one:" in question_text or "Select one :" in question_text:
            match = re.search(r'\[(.*?)\]', question_text)
            if match:
                options_str = match.group(1)
                options_list = [opt.strip() for opt in options_str.split(',')]
                
                options_part = "\n".join([f"{chr(65+i)}) {opt}" for i, opt in enumerate(options_list)])
                
                question_text = re.sub(r'Select one\s*:\s*\[.*?\]', '', question_text).strip()
                
                # Update answer to corresponding letter
                try:
                    option_index = options_list.index(answer)
                    updated_answer = chr(65 + option_index)
                except (ValueError, IndexError):
                    pass
        
        if not options_part:
            # Make sure we're not returning any redundant instructions
            question_clean = question_text.strip()
            return question_clean + "\n\nProvide a direct answer.", answer
    
    # Fix illogical and duplicate options
    if options_part and re.search(r"[A-D]\s*[.)]", options_part):
        options_part, option_mapping = fix_illogical_options(options_part, question_text)
        
        if option_mapping and answer in option_mapping:
            updated_answer = option_mapping[answer]
    
    if options_part and re.search(r"[A-D]\s*[.)]", options_part):
        options_part = fix_duplicate_options(options_part)
    
    # Build clean question
    clean_parts = [question_text.strip(), options_part]
    
    # Add appropriate instruction
    if re.search(r"[A-D]\s*\)", options_part) or re.search(r"[A-D]\s*\.", options_part):
        clean_parts.append("Answer with the letter of the correct option only.")
        
        # Convert text answer to option letter
        letter_answer = convert_text_to_option_letter(options_part, answer)
        if letter_answer:
            updated_answer = letter_answer
    elif any(keyword in question_text.lower() for keyword in ["select one", "choose from", "select from"]):
        clean_parts.append("Select the correct answer from the options.")
    else:
        clean_parts.append("Provide the answer directly.")
    
    return "\n\n".join(clean_parts), updated_answer

def convert_text_to_option_letter(options_text, text_answer):
    """
    将文本答案转换为选项字母
    
    Args:
        options_text: 选项文本
        text_answer: 文本答案
        
    Returns:
        str: 转换后的字母选项，如果找不到匹配项则返回None
    """
    # 提取选项及其字母
    options = []
    option_pattern = r"([A-D][.)])([^A-D]+)"
    for match in re.finditer(option_pattern, options_text):
        option_letter = match.group(1).strip(".)")
        option_value = match.group(2).strip()
        options.append((option_letter, option_value))
    
    # 查找匹配的选项
    for letter, value in options:
        # 精确匹配
        if value.lower() == text_answer.lower():
            return letter
    
    # 模糊匹配 - 处理近似值或包含关系
    for letter, value in options:
        if text_answer.lower() in value.lower() or value.lower() in text_answer.lower():
            return letter
            
    # 处理yes/no特殊情况
    if text_answer.lower() == "yes":
        for letter, value in options:
            if value.lower() == "yes":
                return letter
    elif text_answer.lower() == "no":
        for letter, value in options:
            if value.lower() == "no":
                return letter
    
    return None

def fix_duplicate_options(options_text):
    """
    检测和修复重复的选项值
    
    Args:
        options_text: 选项文本
        
    Returns:
        str: 修复后的选项文本
    """
    # 提取所有选项
    options = []
    option_pattern = r"([A-D][.)])([^A-D]+)"
    for match in re.finditer(option_pattern, options_text):
        option_label = match.group(1)
        option_value = match.group(2).strip()
        options.append((option_label, option_value))
    
    # 检查重复值
    values = [value for _, value in options]
    value_counts = {}
    for value in values:
        value_counts[value] = value_counts.get(value, 0) + 1
    
    # 修复重复值
    fixed_options = []
    used_increments = set()
    
    for label, value in options:
        if value_counts[value] > 1:
            # 尝试数值调整
            try:
                num_value = int(value)
                for increment in range(1, 10):
                    if increment not in used_increments:
                        new_value = str(num_value + increment)
                        used_increments.add(increment)
                        fixed_options.append((label, new_value))
                        break
                else:
                    # 如果无法找到合适的增量，添加后缀
                    fixed_options.append((label, f"{value} (alt)"))
            except ValueError:
                # 非数值，添加区分后缀
                fixed_options.append((label, f"{value} (alt)"))
        else:
            fixed_options.append((label, value))
    
    # 重建选项文本
    new_options_text = ""
    for label, value in fixed_options:
        new_options_text += f"{label} {value}\n"
    
    return new_options_text.strip()

def fix_illogical_options(options_text, question_text):
    """
    检查并修复不合逻辑的选项
    
    Args:
        options_text: 选项文本
        question_text: 问题文本
        
    Returns:
        str: 修复后的选项文本
        dict: 选项值到字母的映射（如果修改了选项）
    """
    # 检查是否是计数类问题
    count_keywords = ["how many", "number of", "count", "quantity"]
    is_count_question = any(keyword in question_text.lower() for keyword in count_keywords)
    
    # 检查是否是比例或比率问题
    ratio_keywords = ["ratio", "proportion", "percentage"]
    is_ratio_question = any(keyword in question_text.lower() for keyword in ratio_keywords)
    
    # 提取所有选项
    options = []
    option_pattern = r"([A-D][.)])([^A-D]+)"
    for match in re.finditer(option_pattern, options_text):
        option_label = match.group(1)
        option_value = match.group(2).strip()
        options.append((option_label, option_value))
    
    fixed_options = []
    option_mapping = {}  # 用于存储修改前后的选项值映射
    
    if is_count_question:
        # 检查是否有负数选项
        for label, value in options:
            try:
                num_value = int(value)
                # 对于计数问题，如果是负数，替换为正数
                if num_value < 0:
                    # 找到最大的选项值作为参考
                    max_val = 0
                    for _, v in options:
                        try:
                            v_num = int(v)
                            if v_num > max_val and v_num >= 0:
                                max_val = v_num
                        except ValueError:
                            continue
                    
                    # 使用最大值+1作为替代
                    new_value = str(max_val + 1)
                    fixed_options.append((label, new_value))
                    option_mapping[new_value] = label.strip(".)") # 存储新值到字母的映射
                else:
                    fixed_options.append((label, value))
                    option_mapping[value] = label.strip(".)")
            except ValueError:
                fixed_options.append((label, value))
                option_mapping[value] = label.strip(".)")
    
    elif is_ratio_question:
        # 对于比例问题，修复负值选项
        for label, value in options:
            try:
                num_value = float(value)
                # 比例问题通常不应有负值（除非明确是增长率等）
                if num_value < 0 and "growth" not in question_text.lower() and "change" not in question_text.lower():
                    # 使用绝对值作为替代
                    new_value = str(abs(num_value))
                    fixed_options.append((label, new_value))
                    option_mapping[new_value] = label.strip(".)") # 存储新值到字母的映射
                else:
                    fixed_options.append((label, value))
                    option_mapping[value] = label.strip(".)") # 存储原值到字母的映射
            except ValueError:
                fixed_options.append((label, value))
                option_mapping[value] = label.strip(".)")
    else:
        # 如果不是特殊类型问题，保持原样并构建映射
        fixed_options = options
        for label, value in options:
            option_mapping[value] = label.strip(".)")
    
    # 重建选项文本
    if fixed_options != options:  # 只有在修改了选项时才重建
        new_options_text = ""
        for label, value in fixed_options:
            new_options_text += f"{label} {value}\n"
        return new_options_text.strip(), option_mapping
    
    return options_text, option_mapping

def clarify_style_question(question):
    """
    明确样式问题的描述，减少模糊性和重复
    
    Args:
        question: 原始问题文本
        
    Returns:
        str: 明确后的问题
    """
    # 处理main text content对齐问题，避免重复
    if "(chart title, subtitle) (chart title, subtitle)" in question:
        question = question.replace("(chart title, subtitle) (chart title, subtitle)", "(chart title, subtitle)")
    elif "alignment style of the main text content" in question.lower() and "(chart title, subtitle)" not in question:
        question = question.replace(
            "main text content", 
            "main text content (chart title, subtitle)"
        )
    
    # 处理main image位置问题
    if "position of the main image" in question.lower() and "decorative images" not in question:
        question = question.replace(
            "main image", 
            "decorative images"
        )
    
    # 处理图像与图表关系问题
    if "how are images presented in relation to" in question.lower() and "decorative images" not in question:
        question = question.replace(
            "How are images presented", 
            "How are decorative images presented"
        )
    
    return question

def generate_multiple_choice_options(questions, image_path):
    """
    使用大模型为选择题生成候选项
    
    Args:
        questions: 需要生成选项的问题列表
        image_path: 图像路径
        
    Returns:
        更新后的问题列表，包含生成的选项
    """
    if not questions:
        return questions
    
    # 准备单个数据对象用于模型调用
    from model.base import SingleData, client
    
    logger.info(f"正在为{len(questions)}个问题生成选择题选项...")
    
    # 将问题分为chart type问题和普通问题
    chart_type_questions = []
    count_questions = []
    normal_questions = []
    
    # 检查是否为chart type相关问题的关键词
    chart_type_keywords = [
        "chart type", "图表类型", "visualization type", "chart kind", "graph type",
        "type of chart", "type of graph", "type of visualization", "类型的图表", "图表的类型"
    ]
    
    # 检查是否为计数类问题的关键词
    count_keywords = ["how many", "number of", "count", "quantity"]
    
    for q in questions:
        question_text = q["question"].lower()
        is_chart_type = any(keyword in question_text for keyword in chart_type_keywords)
        is_count_question = any(keyword in question_text for keyword in count_keywords)
        
        if is_chart_type:
            chart_type_questions.append(q)
        elif is_count_question:
            count_questions.append(q)
        else:
            normal_questions.append(q)
    
    updated_questions = []
    
    # 处理计数类问题
    if count_questions:
        batch_size = 5
        
        for i in range(0, len(count_questions), batch_size):
            batch = count_questions[i:i+batch_size]
            batch_questions = [q["question"] for q in batch]
            batch_answers = [q["answer"] for q in batch]
            
            # 准备提示
            system_message = "You are a professional question generation assistant, specialized in creating appropriate multiple-choice questions for chart understanding tasks."
            
            # 构建用户提示
            user_message = f"""Please generate multiple choice options for the following counting questions. Requirements:
1. Each question should have 4 options (A, B, C, D)
2. Include the correct answer in the options
3. Distractors should be reasonable and plausible
4. All options must be non-negative integers (since these are counting questions)
5. The numerical difference between options should be reasonable
6. Return options for each question in order

Questions and correct answers:
"""
            
            for idx, (q, a) in enumerate(zip(batch_questions, batch_answers)):
                # 删除原有的生成选项的请求提示
                q = q.split("\n\nFor this question, we need multiple choice options")[0]
                user_message += f"\nQuestion {idx+1}: {q}\nCorrect answer: {a}\n"
                
            user_message += "\nPlease return the results in this JSON format:\n```json\n{\n  \"results\": [\n    {\n      \"question_idx\": 0,\n      \"options\": [\"A) Option1\", \"B) Option2\", \"C) Option3\", \"D) Option4\"],\n      \"correct_option\": \"A\"\n    },\n    ...\n  ]\n}\n```"
            
            # 准备消息
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
            
            # 如果有图像，添加图像到请求中
            if image_path and os.path.exists(os.path.join(image_path, "chart.png")):
                from model.base import encode_image_to_base64
                chart_path = os.path.join(image_path, "chart.png")
                base64_image = encode_image_to_base64(chart_path)
                
                if base64_image:
                    messages[1]["content"] = [
                        {"type": "text", "text": user_message},
                        {
                            "type": "image_url", 
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
            
            try:
                # 调用模型
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    response_format={"type": "json_object"}
                )
                
                content = response.choices[0].message.content
                
                # 解析结果
                try:
                    result_data = json.loads(content)
                    options_data = result_data.get("results", [])
                    
                    # 更新问题，添加选项
                    for opt_data in options_data:
                        idx = opt_data.get("question_idx", 0)
                        if idx < len(batch):
                            options = opt_data.get("options", [])
                            correct_option = opt_data.get("correct_option", "")
                            
                            # 检查选项是否合理（确保计数类问题的选项是非负整数）
                            valid_options = []
                            for option in options:
                                # 提取选项数值
                                option_value = option.split(") ")[1].strip() if ") " in option else option
                                try:
                                    num_value = int(option_value)
                                    if num_value >= 0:  # 确保是非负整数
                                        valid_options.append(option)
                                    else:
                                        # 替换为合理的选项
                                        letter = option.split(")")[0] + ")"
                                        valid_options.append(f"{letter} {abs(num_value)}")
                                except ValueError:
                                    valid_options.append(option)  # 如果不是数字，保留原选项
                            
                            # 构建选项字符串
                            options_text = "\n".join(valid_options if valid_options else options)
                            
                            # 更新问题文本，添加选项和回答指导
                            original_question = batch[idx]["question"].split("\n\nFor this question")[0]
                            batch[idx]["question"] = f"{original_question}\n\n{options_text}\n\nAnswer with the letter of the correct option only."
                            
                            # 标记答案格式为选择题
                            batch[idx]["answer_type"] = "multiple_choice"
                            
                            # 更新答案为选项字母
                            batch[idx]["answer"] = correct_option
                    
                    updated_questions.extend(batch)
                    
                except json.JSONDecodeError:
                    logger.error(f"解析JSON失败: {content[:200]}...")
                    # 如果解析失败，保留原问题
                    updated_questions.extend(batch)
                    
            except Exception as e:
                logger.error(f"生成选项时出错: {e}")
                # 出错时保留原问题
                updated_questions.extend(batch)
    
    # 处理普通选择题问题 (ABCD格式)
    if normal_questions:
        batch_size = 5
        
        for i in range(0, len(normal_questions), batch_size):
            batch = normal_questions[i:i+batch_size]
            batch_questions = [q["question"] for q in batch]
            batch_answers = [q["answer"] for q in batch]
            
            # 准备提示
            system_message = "You are a professional question generation assistant, specialized in creating appropriate multiple-choice questions for chart understanding tasks."
            
            # 构建用户提示
            user_message = f"""Please generate multiple choice options for the following questions. Requirements:
1. Each question should have 4 options (A, B, C, D)
2. Include the correct answer in the options
3. Distractors should be reasonable and plausible
4. For numerical questions, maintain consistent precision in all options
5. Keep option text concise
6. Return options for each question in order

Questions and correct answers:
"""
            
            for idx, (q, a) in enumerate(zip(batch_questions, batch_answers)):
                # 删除原有的生成选项的请求提示
                q = q.split("\n\nFor this question, we need multiple choice options")[0]
                user_message += f"\nQuestion {idx+1}: {q}\nCorrect answer: {a}\n"
                
            user_message += "\nPlease return the results in this JSON format:\n```json\n{\n  \"results\": [\n    {\n      \"question_idx\": 0,\n      \"options\": [\"A) Option1\", \"B) Option2\", \"C) Option3\", \"D) Option4\"],\n      \"correct_option\": \"A\"\n    },\n    ...\n  ]\n}\n```"
            
            # 准备消息
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
            
            # 如果有图像，添加图像到请求中
            if image_path and os.path.exists(os.path.join(image_path, "chart.png")):
                from model.base import encode_image_to_base64
                chart_path = os.path.join(image_path, "chart.png")
                base64_image = encode_image_to_base64(chart_path)
                
                if base64_image:
                    messages[1]["content"] = [
                        {"type": "text", "text": user_message},
                        {
                            "type": "image_url", 
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
            
            try:
                # 调用模型
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    response_format={"type": "json_object"}
                )
                
                content = response.choices[0].message.content
                
                # 解析结果
                try:
                    result_data = json.loads(content)
                    options_data = result_data.get("results", [])
                    
                    # 更新问题，添加选项
                    for opt_data in options_data:
                        idx = opt_data.get("question_idx", 0)
                        if idx < len(batch):
                            options = opt_data.get("options", [])
                            correct_option = opt_data.get("correct_option", "")
                            
                            # 构建选项字符串
                            options_text = "\n".join(options)
                            
                            # 更新问题文本，添加选项和回答指导
                            original_question = batch[idx]["question"].split("\n\nFor this question")[0]
                            batch[idx]["question"] = f"{original_question}\n\n{options_text}\n\nAnswer with the letter of the correct option only."
                            
                            # 标记答案格式为选择题
                            batch[idx]["answer_type"] = "multiple_choice"
                            
                            # 更新答案为选项字母
                            batch[idx]["answer"] = correct_option
                    
                    updated_questions.extend(batch)
                    
                except json.JSONDecodeError:
                    logger.error(f"解析JSON失败: {content[:200]}...")
                    # 如果解析失败，保留原问题
                    updated_questions.extend(batch)
                    
            except Exception as e:
                logger.error(f"生成选项时出错: {e}")
                # 出错时保留原问题
                updated_questions.extend(batch)
    
    # 处理chart type问题（7-8个候选项，不使用ABCD格式）
    if chart_type_questions:
        batch_size = 3  # chart type问题每批处理3个
        
        for i in range(0, len(chart_type_questions), batch_size):
            batch = chart_type_questions[i:i+batch_size]
            batch_questions = [q["question"] for q in batch]
            batch_answers = [q["answer"] for q in batch]
            
            # 准备提示
            system_message = "You are a professional chart analysis assistant, specialized in identifying chart types and providing accurate classification."
            
            # 构建用户提示
            user_message = f"""Please provide candidate options for the following chart type questions. Requirements:
1. For each question, provide 7-8 reasonable chart type options (no numbering needed)
2. Include the correct answer in the options
3. Options should be common chart type names
4. Return options for each question in order

Questions and correct answers:
"""
            
            for idx, (q, a) in enumerate(zip(batch_questions, batch_answers)):
                # 删除原有的生成选项的请求提示
                q = q.split("\n\nFor this question, we need multiple choice options")[0]
                user_message += f"\nQuestion {idx+1}: {q}\nCorrect answer: {a}\n"
                
            user_message += "\nPlease return the results in this JSON format:\n```json\n{\n  \"results\": [\n    {\n      \"question_idx\": 0,\n      \"options\": [\"Bar chart\", \"Line chart\", \"Pie chart\", \"Scatter plot\", \"Heatmap\", \"Radar chart\", \"Bubble chart\", \"Box plot\"],\n      \"correct_option\": \"Line chart\"\n    },\n    ...\n  ]\n}\n```"
            
            # 准备消息
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
            
            # 如果有图像，添加图像到请求中
            if image_path and os.path.exists(os.path.join(image_path, "chart.png")):
                from model.base import encode_image_to_base64
                chart_path = os.path.join(image_path, "chart.png")
                base64_image = encode_image_to_base64(chart_path)
                
                if base64_image:
                    messages[1]["content"] = [
                        {"type": "text", "text": user_message},
                        {
                            "type": "image_url", 
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
            
            try:
                # 调用模型
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    response_format={"type": "json_object"}
                )
                
                content = response.choices[0].message.content
                
                # 解析结果
                try:
                    result_data = json.loads(content)
                    options_data = result_data.get("results", [])
                    
                    # 更新问题，添加选项
                    for opt_data in options_data:
                        idx = opt_data.get("question_idx", 0)
                        if idx < len(batch):
                            options = opt_data.get("options", [])
                            
                            options_text = "Chart type options:\n" + "\n".join([f"- {opt}" for opt in options])
                            options_text += f"\n\nPlease select the correct chart type from the options above."
                            
                            original_question = batch[idx]["question"].split("\n\nFor this question")[0]
                            batch[idx]["question"] = f"{original_question}\n\n{options_text}"
                            
                            # 标记答案格式为自由文本
                            batch[idx]["answer_type"] = "open"
                    
                    updated_questions.extend(batch)
                    
                except json.JSONDecodeError:
                    logger.error(f"解析JSON失败: {content[:200]}...")
                    # 如果解析失败，保留原问题
                    updated_questions.extend(batch)
                    
            except Exception as e:
                logger.error(f"生成选项时出错: {e}")
                # 出错时保留原问题
                updated_questions.extend(batch)
    
    return updated_questions

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
    process_folder(
        folder_path="/data/lizhen/resources/generated/0428",  # 包含多个数据目录的父文件夹
        output_path="./train.jsonl",
        template_path="./example.json",
        image_output_dir="./train_images",
        custom_instruction_suffix="", # 移除默认的冗余指令
        include_multiple_choice=True,
        style_percentage=50,
        num_threads=10
    )
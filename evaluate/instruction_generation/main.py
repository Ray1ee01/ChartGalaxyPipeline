import json

from model.factory import QAGeneratorFactory
from template.question_answer_generator import QuestionAnswerGenerator
from model.base import SingleData
from tqdm import tqdm
import logging
import random

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("InstructionGeneration.")

def process(data_path, image_path, output_path="./output.json", template_path=None,
            use_model=True, use_template=True, write2disk=False, num=10):
    all_results = []

    if num > 20:
        logger.warning("可能数量超过了最大可提供数量")

    model_generating_num = num // 5 * 3
    template_generating_num = max(0, num - model_generating_num)

    if use_model:
        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        tabular_data = data["data"]
        meta_data = data["metadata"]

        single_data = SingleData(tabular_data, meta_data, image_path)
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
        
        pairs = generator.generate()

        for pair in pairs:
            pair["question_type"] = "template"
            pair["answer_type"] = "close"
            pair.pop("template", None) 

        all_results.extend(random.sample(pairs, min(template_generating_num, len(pairs))))

    if write2disk:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(all_results, f, indent=2, ensure_ascii=False)

    return all_results

if __name__ == "__main__":
    process(
        data_path="/data/lizhen/resources/result/data_pool_v3/aug_cn_4745.json",
        image_path="/home/lizhen/ChartPipeline/framework/output/0424_1/1745514551_horizontal_lollipop_chart_01_aug_cn_4745/chart.png",
        output_path="./output.json",
        template_path="/home/lizhen/ChartPipeline/evaluate/instruction_generation/example.json",
        write2disk=True
    )
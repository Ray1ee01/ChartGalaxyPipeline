from src.pipeline import Pipeline
from src.processors.chart_generator import VegaLiteGenerator
from src.processors.svg_processor import SVGOptimizer
import os
from src.utils.dataset import VizNET
from src.processors.data_processor import *
import random

# data_dir = os.path.join(os.path.dirname(__file__),'src', 'data')
output_dir = os.path.join(os.path.dirname(__file__),'src', 'output4')
os.environ["TOKENIZERS_PARALLELISM"] = "false"
# random.seed(15)


def main():
    import argparse
    
    # 创建命令行参数解析器
    parser = argparse.ArgumentParser(description='生成图表')
    parser.add_argument('-d', '--dataset_idx', type=int, default=0, help='数据集索引')
    parser.add_argument('-c', '--chart_idx', type=int, default=1, help='图表索引')
    # parser.add_argument('-l', '--layout_file_idx', type=int, default=1, help='布局文件索引')
    # parser.add_argument('-i', '--chart_image_idx', type=int, default=1, help='图表图片索引')
    args = parser.parse_args()

    # # 创建pipeline
    # pipeline = Pipeline(
    #     data_processor=VizNetDataProcessor(),
    #     chart_generator=VegaLiteGenerator(),
    #     svg_processor=SVGOptimizer()
    # )
    pipeline = Pipeline(
        data_processor=Chart2TableDataProcessor(),
        chart_generator=VegaLiteGenerator(),
        svg_processor=SVGOptimizer()
    )

    
    # layout_file_idx = random.randint(1, 6)
    # chart_image_idx = random.randint(1, 7)
    # chart_image_idx = 6
    layout_file_idx = 2
    chart_image_idx = 2

    # dataset = VizNET()
    # input_data = dataset.get_object(args.dataset_idx, args.chart_idx)
    # input_data = '1_1'
    input_data = 'bar_1'
    result = pipeline.execute(input_data, layout_file_idx, chart_image_idx)

    # 保存结果,文件名包含索引信息
    output_filename = f'output_d{args.dataset_idx}_c{args.chart_idx}_l{layout_file_idx}_i{chart_image_idx}.svg'
    with open(os.path.join(output_dir, output_filename), "w") as f:
        f.write(result)

if __name__ == "__main__":
    main()
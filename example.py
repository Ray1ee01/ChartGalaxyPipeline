from src.pipeline import Pipeline
from src.processors.chart_generator import VegaLiteGenerator
from src.processors.svg_processor import SVGOptimizer
import os
from src.utils.dataset import VizNET
from src.processors.data_processor import *
import random

# data_dir = os.path.join(os.path.dirname(__file__),'src', 'data')
output_dir = os.path.join(os.path.dirname(__file__),'src', 'output6')
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
    # data_range = np.arange(2, 184)
    # input_data = f'bar_{data_range[args.chart_idx]}'

    
    layout_file_idx = random.randint(1, 6)
    chart_image_idx = random.randint(1, 7)
    # chart_image_idx = 6
    layout_file_idx = 14
    chart_image_idx = 2
    chart_component_idx = 1
    # color_mode = 'polychromatic'
    color_mode = 'monochromatic'
    # layout_file_idxs = [1, 2, 3, 4, 5, 6]
    # chart_image_idxs = [1, 2, 3, 4, 5, 6, 7]
    # chart_component_idxs = [1, 2]
    # chart_component_idxs = [2]
    
    input_data = f'line_0'
    result = pipeline.execute(input_data, layout_file_idx, chart_image_idx, chart_component_idx, color_mode)
    # output_filename = f'output_d22_l14_i2_c2_mmonochromatic.svg'
    output_filename = f'output_d0_l14_i2_c2_mpolychromatic.svg'
    with open(os.path.join(output_dir, output_filename), "w") as f:
        f.write(result)
    # color_modes = ['monochromatic', 'complementary', 'analogous', 'polychromatic']
    # for data_idx in data_range:
    #     input_data = f'bar_{data_idx}'
    #     # 随机选择layout_file_idx, chart_image_idx, chart_component_idx, color_mode
    #     layout_file_idx = random.randint(1, 6)
    #     chart_image_idx = random.randint(1, 7)
    #     chart_component_idx = random.randint(1, 2)
    #     color_mode = random.choice(['monochromatic', 'complementary', 'analogous', 'polychromatic'])
    #     result = pipeline.execute(input_data, layout_file_idx, chart_image_idx, chart_component_idx, color_mode)
    #     # output_filename = f'output_d{args.dataset_idx}_c{args.chart_idx}_l{layout_file_idx}_i{chart_image_idx}_c{chart_component_idx}_m{color_mode}.svg'
    #     output_filename = f'output_d{data_idx}_l{layout_file_idx}_i{chart_image_idx}_c{chart_component_idx}_m{color_mode}.svg'

        # with open(os.path.join(output_dir, output_filename), "w") as f:
        #     f.write(result)
        
        
    # for layout_file_idx in layout_file_idxs:
    #     for chart_image_idx in chart_image_idxs:
    #         for chart_component_idx in chart_component_idxs:
    #             for color_mode in color_modes:
    #                 result = pipeline.execute(input_data, layout_file_idx, chart_image_idx, chart_component_idx, color_mode)
    #                 output_filename = f'output_d{args.dataset_idx}_c{args.chart_idx}_l{layout_file_idx}_i{chart_image_idx}_c{chart_component_idx}_m{color_mode}.svg'
    #                 with open(os.path.join(output_dir, output_filename), "w") as f:
    #                     f.write(result)

    # # dataset = VizNET()
    # # input_data = dataset.get_object(args.dataset_idx, args.chart_idx)
    # # input_data = '1_1'
    # result = pipeline.execute(input_data, layout_file_idx, chart_image_idx)
    # result = pipeline.execute(input_data, layout_file_idx, chart_image_idx, chart_component_idx, color_mode)
    # # 保存结果,文件名包含索引信息
    # output_filename = f'output_d{args.dataset_idx}_c{args.chart_idx}_l{layout_file_idx}_i{chart_image_idx}_c{chart_component_idx}_m{color_mode}.svg'
    # with open(os.path.join(output_dir, output_filename), "w") as f:
    #     f.write(result)

if __name__ == "__main__":
    main()
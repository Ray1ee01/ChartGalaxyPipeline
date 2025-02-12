from src.pipeline import Pipeline
from src.processors.chart_generator import VegaLiteGenerator
from src.processors.svg_processor import SVGOptimizer
from src.processors.data_processor import Chart2TableDataProcessor
import os
import json

class CustomDataProcessor(Chart2TableDataProcessor):
    def process(self, raw_data: str, layout_sequence: list, chart_image_sequence: list, matcher=None):
        # 调用父类的处理方法
        processed_data = super().process(raw_data, layout_sequence, chart_image_sequence, matcher)
        
        # 修改图表类型为 area
        # processed_data['meta_data']['chart_type'] = 'area'
        # processed_data['meta_data']['chart_type'] = 'layeredarea'
        processed_data['meta_data']['chart_type'] = 'stream'
        # processed_data['meta_data']['chart_type'] = 'line'
        
        return processed_data

def main():
    # 使用自定义的数据处理器
    pipeline = Pipeline(
        data_processor=CustomDataProcessor(),  # 使用自定义处理器
        chart_generator=VegaLiteGenerator(),
        svg_processor=SVGOptimizer()
    )

    # 使用 line 类型的数据
    input_data = "line_8"

    # 生成图表
    result, bounding_boxes = pipeline.execute(
        input_data=input_data,
        layout_file_idx=1,
        chart_image_idx=1,
        color_mode='monochromatic'
    )

    # 保存结果
    output_dir = 'output'
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'stream_chart.svg')
    with open(output_path, 'w') as f:
        f.write(result)

if __name__ == "__main__":
    main()
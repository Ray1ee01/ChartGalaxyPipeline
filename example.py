from src.pipeline import Pipeline
from src.processors.chart_generator import VegaLiteGenerator, EchartGenerator
from src.processors.svg_processor import SVGOptimizer
import os
from src.utils.dataset import VizNET
from src.processors.data_processor import *
# from src.utils.svg_converter import convert_svg_to_png
import random
import json
import numpy as np
from datetime import datetime
from src.processors.data_enricher_modules.icon_selection import CLIPMatcher
from src.processors.data_enricher_modules.bgimage_selection import ImageSearchSystem
from src.data.config.config import load_config



# data_dir = os.path.join(os.path.dirname(__file__),'src', 'data')
# output_dir = os.path.join(os.path.dirname(__file__),'src', 'output9')
os.environ["TOKENIZERS_PARALLELISM"] = "false"


# random.seed(15)


def main():
    import argparse
    
    # 创建命令行参数解析器
    parser = argparse.ArgumentParser(description='生成图表')
    # parser.add_argument('-d', '--dataset_idx', type=int, default=0, help='数据集索引')
    # parser.add_argument('-c', '--chart_idx', type=int, default=1, help='图表索引')
    # parser.add_argument('-t', '--chart_type', type=str, default='bar', help='图表类型')
    parser.add_argument('-c', '--config_idx', type=int, default=0, help='配置索引')
    args = parser.parse_args()

    configs = load_config(args.config_idx)
    print(configs)
    
    pipeline = Pipeline(
        data_processor=Chart2TableDataProcessor(),
        # data_processor=VizNetDataProcessor(),
        chart_generator=VegaLiteGenerator(),
        # chart_generator=EchartGenerator(),
        svg_processor=SVGOptimizer()
    )
    
    chart_type_list = [
        'bar',
        'line',
        'bump',
        'scatter',
        'connectedscatter',
        'bubble',
        'groupbar',
        'stackedbar',
        'slope',
        'pie',
        'donut',
        'bullet',
        'radialbar',
        "area",
        "line",
        "stream",
        "rangedarea",
        "layeredarea",
        "stackedarea"
        # 'waterfall',
    ]
    
    data_sizes = {
        'bar': 200,
        'line': 105,
        'bump': 2,
        'scatter': 3,
        'connectedscatter': 1,
        'bubble': 2,
        'stackedbar': 42,
        'slope': 1,
        'groupbar': 42,
        'pie': 1,
        'donut': 1,
    }
    
    
    matcher = CLIPMatcher()
    # bgimage_searcher = ImageSearchSystem()
    bgimage_searcher = None
    
    date = datetime.now().strftime("%Y%m%d")
    valid_chart_types = configs['layout']['chart_config']['valid_type']
    for chart_type in valid_chart_types:
        if chart_type not in chart_type_list:
            print(f'{chart_type} is not in chart_type_list')
            continue
        output_dir = os.path.join(os.path.dirname(__file__),'src', f'output_{date}', chart_type)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        # data_range = np.arange(0, data_sizes[chart_type])
        data_range = np.arange(0,10)
        # data_range = np.arange(39,40)
        # data_range = np.arange(197,198)
        # data_range = np.arange(164,165)
        for data_idx in data_range:
            time_stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            input_data = f'{chart_type}_{data_idx}'
            result, bounding_boxes = pipeline.execute(input_data, config=configs, matcher=matcher, bgimage_searcher=bgimage_searcher)
            output_filename = f'{time_stamp}_type_{chart_type}_d{data_idx}_c{args.config_idx}'
            with open(os.path.join(output_dir, output_filename+'.svg'), "w") as f:
                f.write(result)

            
    # return
    
    # if args.chart_type in chart_type_list:
    #     chart_type = args.chart_type
    #     output_dir = os.path.join(os.path.dirname(__file__),'src', 'output_9', chart_type)
    #     if not os.path.exists(output_dir):
    #         os.makedirs(output_dir)
    #     # data_range = np.arange(0, data_sizes[chart_type])
    #     data_range = np.arange(1,3)
    #     for data_idx in data_range:
    #         time_stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    #         input_data = f'{chart_type}_{data_idx}'
            
    #         time_start = time.time()
    #         result, bounding_boxes = pipeline.execute(input_data, config=configs, matcher=matcher, bgimage_searcher=bgimage_searcher)
    #         time_end = time.time()
    #         print(f'pipeline execute time cost: {time_end - time_start} seconds')
    #         # output_filename = f'output_d{args.dataset_idx}_c{args.chart_idx}_l{layout_file_idx}_i{chart_image_idx}_c{chart_component_idx}_m{color_mode}.svg'
    #         output_filename = f'{time_stamp}_type_{chart_type}_d{data_idx}_l{layout_file_idx}_i{chart_image_idx}_c{chart_component_idx}_m{color_mode}'
    #         with open(os.path.join(output_dir, output_filename+'.svg'), "w") as f:
    #             f.write(result)
            # # convert svg to png
            # time_start = time.time()
            # width, height, svg_width, svg_height = convert_svg_to_png(os.path.join(output_dir, output_filename+'.svg'), os.path.join(output_dir, output_filename+'.png'))
            # time_end = time.time()
            # print(f'convert svg to png time cost: {time_end - time_start} seconds')
            
            # time_start = time.time()
            # scale = width / svg_width
            # print("scale: ", scale)
            # # 将bounding_boxes中的minx, miny, maxx, maxy,width, height乘以scale
            # for key in bounding_boxes.keys():
            #     item = bounding_boxes[key]
            #     if isinstance(item, list):
            #         for box in item:
            #             box['minx'] *= scale
            #             box['miny'] *= scale
            #             box['maxx'] *= scale
            #             box['maxy'] *= scale
            #             box['width'] *= scale
            #             box['height'] *= scale
            #     else:
            #         bounding_boxes[key]['minx'] *= scale
            #         bounding_boxes[key]['miny'] *= scale
            #         bounding_boxes[key]['maxx'] *= scale
            #         bounding_boxes[key]['maxy'] *= scale
            #         bounding_boxes[key]['width'] *= scale
            #         bounding_boxes[key]['height'] *= scale
            # # 保存bounding_boxes
            # time_end = time.time()
            # print(f'save bounding_boxes time cost: {time_end - time_start} seconds')
            # time_start = time.time()
            # with open(os.path.join(output_dir, output_filename+'_bounding_boxes.json'), "w") as f:
            #     json.dump(bounding_boxes, f)
            # time_end = time.time()
            # print(f'save bounding_boxes time cost: {time_end - time_start} seconds')
            # # 把boundingbox绘制到png上
            # time_start = time.time()
            # draw_bounding_boxes(os.path.join(output_dir, output_filename+'.png'), bounding_boxes)
            # time_end = time.time()
            # print(f'draw bounding_boxes time cost: {time_end - time_start} seconds')
            # except Exception as e:
            #     print(e)
            #     continue


def draw_bounding_boxes(png_path, bounding_boxes):
    import cv2
    import numpy as np
    # 读取PNG图像
    image = cv2.imread(png_path)
    # 遍历bounding_boxes
    for key in bounding_boxes.keys():
        item = bounding_boxes[key]
        if isinstance(item, list):
            for box in item:
                # 将浮点数坐标转换为整数
                x1 = int(round(box['minx']))
                y1 = int(round(box['miny']))
                x2 = int(round(box['maxx']))
                y2 = int(round(box['maxy']))
                cv2.rectangle(image, (x1, y1), (x2, y2), (0, 0, 255), 2)
        else:
            # 将浮点数坐标转换为整数
            x1 = int(round(item['minx']))
            y1 = int(round(item['miny']))
            x2 = int(round(item['maxx']))
            y2 = int(round(item['maxy']))
            cv2.rectangle(image, (x1, y1), (x2, y2), (0, 0, 255), 2)
    # 保存图像
    new_png_path = png_path.replace('.png', '_bounding_boxes.png')
    cv2.imwrite(new_png_path, image)



if __name__ == "__main__":
    main()
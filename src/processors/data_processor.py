import time
from typing import Any, Dict, List
from ..interfaces.base import DataProcessor
import pandas as pd
import numpy as np
import os
from IPython import embed
import shutil
import json
from .data_enricher_modules.data_clean import clean_df
from .data_enricher_modules.HAI_extract import extract_chart
from .data_enricher_modules.topic_generate import check_topic_and_caption, generate_bgimage_search_keywords, if_has_country_name
from .data_enricher_modules.image_search import search_image

from .data_enricher_modules.icon_selection import get_icon_pool, CLIPMatcher
from .icon_selection_modules.icon_selection import IconSelector
from .data_enricher_modules.data_loader import *
from .data_enricher_modules.chart_extractor import *
from .data_enricher_modules.bgimage_selection import ImageSearchSystem
from .data_enricher_modules.datafact_generator import DataFactGenerator
from .data_enricher_modules.palette_extractor import extract_palette
from .data_enricher_modules.data_fact_detector import DataFactDetector

data_save_dir = './src/data'
cache_dir = './src/cache'
image_root = "D:/VIS/Infographics/data/check_202501022351"


class CSVDataProcessor(DataProcessor):
    def process(self, raw_data: str) -> List[Dict]:
        # 示例：处理CSV数据
        df = pd.read_csv(raw_data)
        return df.to_dict('records')

class JSONDataProcessor(DataProcessor):
    def process(self, raw_data: str) -> List[Dict]:
        # 示例：处理JSON数据
        import json
        with open(raw_data, 'r') as f:
            data = json.load(f)
        return data

class VizNetDataProcessor(DataProcessor):
    def process(self, raw_data: str, layout_sequence: List[str], chart_image_sequence: List[str], matcher: CLIPMatcher) -> List[Dict]:

        dataloader = VizNetDataLoader()
        number = raw_data.split('_')[-1]
        
        # df, raw_meta_data = dataloader.load(raw_data)
        df, raw_meta_data = dataloader.load(number)
        print(df, raw_meta_data)
        
        _,__ = GPTChartExtractor().extract(df, options={
            "x_type": "categorical",
            "y_type": "numerical",
            "group_by": "categorical",
            "y2_type": "numerical",
        })
        chart_extractor = HAIChartExtractor()
        data, meta_data = chart_extractor.extract(df)
        meta_data.update(raw_meta_data)
        
        
        # 3. generate topic and description
        topic_data = check_topic_and_caption(df, meta_data) 
        
        chart_data = {
            "data": data,
            "meta_data": meta_data,
        }
        
        # # 4. get data facts
        # data_fact_generator = DataFactGenerator(chart_data, topic_data)
        # data_fact = data_fact_generator.generate_data_fact()

        data_fact_detector = DataFactDetector()
        data_fact, data_fact_icon = data_fact_detector.detect_data_facts(chart_data)
        
        # 5. get topic relevant images
        # topic_images_query = search_image(meta['topic'])
        topic_images_query = {}
        # if need more images, search for meta['keywords']



        # 6. get chart relevant icons
        time_start = time.time()
        # matcher = CLIPMatcher()  # 只创建一次CLIPMatcher实例
        
        # icon_pool = get_icon_pool(chart_data, topic_data, matcher)
        with open('./src/processors/style_design_modules/image_paths.json') as f:
            image_paths = json.load(f)
        default_image_path = '/data1/jiashu/ChartPipeline/src/processors/style_design_modules/default.png'
        
        palettes = extract_palette(topic_data, cache_dir, image_root, image_paths, default_image_path)

        result = {}
        result['meta_data'] = meta_data.copy()
        result['meta_data'].update(chart_data['meta_data'])
        result['meta_data'].update(topic_data)
        result['data'] = chart_data['data']
        result['data_facts'] = data_fact
        result['icons'] = {}
        
        icon_selector = IconSelector(icon_pool, topic_color=None, spe_mode='flag')
        candidate_icons = icon_selector.select(layout_sequence, chart_image_sequence)

        topic_icon_idx = -1
        x_single_icon_idx = -1
        x_multi_icon_idx = -1
        if 'topic_icon' in layout_sequence:
            topic_icon_idx = 0
        if 'x_single_icon' in chart_image_sequence:
            x_single_icon_idx = topic_icon_idx + 1
        else:
            x_single_icon_idx = topic_icon_idx
        if 'x_multiple_icon' in chart_image_sequence:
            x_multi_icon_idx = x_single_icon_idx + 1
        else:
            x_multi_icon_idx = x_single_icon_idx
        
        topic_icon_pool = candidate_icons[0:topic_icon_idx+1]
        x_data_single_icon_pool = candidate_icons[topic_icon_idx+1:x_single_icon_idx+1]
        x_data_multi_icon_pool = candidate_icons[x_multi_icon_idx:]
        # make them always be a list
        if not isinstance(topic_icon_pool, list):
            topic_icon_pool = [topic_icon_pool]
        if not isinstance(x_data_single_icon_pool, list):
            x_data_single_icon_pool = [x_data_single_icon_pool]
        if not isinstance(x_data_multi_icon_pool, list):
            x_data_multi_icon_pool = [x_data_multi_icon_pool]
        
        icon_semantic = icon_pool
        icon_positions = icon_semantic.icon_positions
        icon_root = "/data1/liduan/generation/chart/iconset/colored_icons_new"
        result['icons']['topic'] = [os.path.join(icon_root, icon_positions[v][0], icon_positions[v][1]) for v in topic_icon_pool]
        result['icons']['x_data_single'] = [os.path.join(icon_root, icon_positions[v][0], icon_positions[v][1]) for v in x_data_single_icon_pool]
        result['icons']['x_data_multi'] = [os.path.join(icon_root, icon_positions[v][0], icon_positions[v][1]) for v in x_data_multi_icon_pool]
        
        result['palettes'] = palettes
        return result
    
class Chart2TableDataProcessor(DataProcessor):
    def process(self, raw_data: str, layout_sequence: List[str], chart_image_sequence: List[str], matcher: CLIPMatcher, bgimage_searcher: ImageSearchSystem = None) -> List[Dict]:
        chart_type = raw_data.split('_')[0]
        dataloader = Chart2TableDataLoader()
        df, raw_meta_data = dataloader.load(raw_data)
        
        chart_extractor = NaiveChartExtractor()
        data, meta_data = chart_extractor.extract(df)
        meta_data.update(raw_meta_data)
        
        # 3. generate topic and description
        topic_data = check_topic_and_caption(df, meta_data)
        
        chart_data = {
            "data": data,
            "meta_data": meta_data,
        }
        
        # # 4. get data facts
        # data_fact_generator = DataFactGenerator(chart_data, topic_data)
        # data_fact = data_fact_generator.generate_data_fact()
        # data_fact = {} # 这里可以去掉了

        data_fact_detector = DataFactDetector()
        data_fact, data_fact_icon = data_fact_detector.detect_data_facts(chart_data, chart_type)
        
        # # 4.5. get palettes
        default_image_path = '/data1/jiashu/ChartPipeline/src/processors/style_design_modules/default.png'
        with open('./src/processors/style_design_modules/image_paths.json') as f:
            image_paths = json.load(f)
        palettes = extract_palette(topic_data, cache_dir, image_root, image_paths, default_image_path)
        
        
        topic_image_url = ""
        # # 5. get topic relevant images
        # key_words = generate_bgimage_search_keywords(df, meta_data)
        # key_word = key_words[0][0]
        # chinese_keyword = key_words[1][0]
        # if bgimage_searcher is not None:
        #     topic_image = bgimage_searcher.search(key_word, chinese_keyword, palettes)
        #     topic_image_url = topic_image['path']
        # else:
        #     # topic_image_urls = search_image(chinese_keyword, engine='baidu')
        #     # topic_image_url = topic_image_urls[0]
        #     topic_image_url = ""
        
        

        # topic_image_url = np.random.choice(topic_image_urls)
        
        # print("topic_images_query: ", topic_image_query)
        # topic_image_url = topic_image_query['images_results'][0]['original']
        # return 
        # topic_images_query = {}
        # if need more images, search for meta['keywords']

        # 6. get chart relevant icons
        time_start = time.time()
        # matcher = CLIPMatcher()  # 只创建一次CLIPMatcher实例
        icon_pool = get_icon_pool(chart_data, topic_data, matcher)
        result = {}
        result['meta_data'] = meta_data.copy()
        result['meta_data'].update(chart_data['meta_data'])
        result['meta_data'].update(topic_data)
        # result['meta_data']['chart_type'] = 'bar'
        result['meta_data']['chart_type'] = chart_type
        result['data'] = chart_data['data']
        result['data_facts'] = data_fact
        result['icons'] = {}

        icon_pool = get_icon_pool(chart_data, topic_data, matcher)
        if if_has_country_name(chart_data['data']):
        # if True:
            icon_selector = IconSelector(icon_pool, topic_color=None, spe_mode='flag')
            print("has country name")
        else:
            icon_selector = IconSelector(icon_pool, topic_color=None)
            print("no country name")
        # icon_selector = IconSelector(icon_pool, topic_color=None)
        candidate_icons = icon_selector.select(layout_sequence, chart_image_sequence)
        # candidate_icons = [[],[]]
        if isinstance(candidate_icons, tuple):
            candidate_icons = candidate_icons[0] + candidate_icons[1]
        # print("candidate_icons: ", candidate_icons)
        topic_icon_idx = -1
        x_single_icon_idx = -1
        x_multi_icon_idx = -1
        if 'topic_icon' in layout_sequence:
            topic_icon_idx = 0
        if 'x_single_icon' in chart_image_sequence:
            x_single_icon_idx = topic_icon_idx + 1
        else:
            x_single_icon_idx = topic_icon_idx
        if 'x_multiple_icon' in chart_image_sequence:
            x_multi_icon_idx = x_single_icon_idx + 1
        else:
            x_multi_icon_idx = x_single_icon_idx
        
        icon_semantic = icon_pool
        icon_positions = icon_semantic.icon_positions
        
        topic_icon_pool = candidate_icons[0:topic_icon_idx+1]
        x_data_single_icon_pool = candidate_icons[topic_icon_idx+1:x_single_icon_idx+1]
        x_data_multi_icon_pool = candidate_icons[x_multi_icon_idx:]
        # make them always be a list
        if not isinstance(topic_icon_pool, list):
            topic_icon_pool = [topic_icon_pool]
        if not isinstance(x_data_single_icon_pool, list):
            x_data_single_icon_pool = [x_data_single_icon_pool]
        if not isinstance(x_data_multi_icon_pool, list):
            x_data_multi_icon_pool = [x_data_multi_icon_pool]
        

        icon_root = "/data1/liduan/generation/chart/iconset/colored_icons_new"
        result['icons']['topic'] = [os.path.join(icon_root, icon_positions[v][0], icon_positions[v][1]) if isinstance(v, int) else v for v in topic_icon_pool]
        # result['icons']['topic'] = [topic_image_url]
        result['icons']['x_data_single'] = [os.path.join(icon_root, icon_positions[v][0], icon_positions[v][1]) if isinstance(v, int) else v for v in x_data_single_icon_pool]
        result['icons']['x_data_multi'] = [os.path.join(icon_root, icon_positions[v][0], icon_positions[v][1]) if isinstance(v, int) else v for v in x_data_multi_icon_pool]
        result['icons']['background_image'] = topic_image_url
        x_data_multi_icon_map = {}
        # for i, data in enumerate(result['data']):
        #     x_data_multi_icon_map[data['x_data']] = result['icons']['x_data_multi'][i]
        result['x_data_multi_icon_map'] = x_data_multi_icon_map
        result['palettes'] = palettes
        return result
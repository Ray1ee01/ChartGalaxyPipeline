import time
from typing import Any, Dict, List
from ..interfaces.base import DataProcessor
import pandas as pd
import numpy as np
import os
from IPython import embed
import shutil
from .data_enricher_modules.data_clean import clean_df
from .data_enricher_modules.HAI_extract import extract_chart
from .data_enricher_modules.topic_generate import check_topic_and_caption
from .data_enricher_modules.image_search import search_image
from .data_enricher_modules.icon_selection import get_icon_pool, CLIPMatcher

data_save_dir = './src/data'
cache_dir = './src/cache'

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
    def process(self, raw_data: Dict) -> List[Dict]:
        time_start = time.time()
        # 1. extract and clean df data
        table = raw_data['relation']
        table = np.array(table).T.tolist()
        columns = table[0]
        table = table[1:]
        df = pd.DataFrame(table, columns=columns)
        df = clean_df(df)
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)
        cache_path = os.path.join(cache_dir, 'df.csv')
        df.to_csv(cache_path, index=False)
        time_end = time.time()
        print('time cost for clean_df: ', time_end - time_start)

        time_start = time.time()
        # 2. find potential chart and data
        json_path = os.path.join(cache_dir, 'json')
        shutil.rmtree(json_path, ignore_errors=True)
        os.makedirs(json_path)
        res, valid_chart_num = extract_chart(cache_path, json_path)
        time_end = time.time()
        print('time cost for extract_chart: ', time_end - time_start)

        time_start = time.time()
        # 3. generate topic and description
        meta_data = {
            'pageTitle': raw_data['pageTitle'],
            'title': raw_data['title'],
            'url': raw_data['url'],
            'textBeforeTable': raw_data['textBeforeTable'],
            'textAfterTable': raw_data['textAfterTable'],
            # 'TableContextTimeStampAfterTable': raw_data['TableContextTimeStampAfterTable'],
        }
        meta = check_topic_and_caption(df, meta_data) 
        time_end = time.time()
        print('time cost for check_topic_and_caption: ', time_end - time_start)

        time_start = time.time()
        # 4. get data facts
        data_facts = []
        for chart in res:
            data_fact = {}
            # trend
            if 'group' not in chart['data'][0] and \
                chart['meta_data']['x_type'] == 'temporal' and chart['meta_data']['chart_type'] != 'scatter':
                # check increasing or decreasing
                y_data = [v['y_data'] for v in chart['data']]
                if all([y_data[i] <= y_data[i+1] for i in range(len(y_data)-1)]):
                    data_fact['trend'] = 'increasing'
                elif all([y_data[i] >= y_data[i+1] for i in range(len(y_data)-1)]):
                    data_fact['trend'] = 'decreasing'
            # top and bottom
            if 'group' not in chart['data'][0] and \
                chart['meta_data']['x_type'] == 'categorical' and chart['meta_data']['chart_type'] != 'scatter':
                y_data = [v['y_data'] for v in chart['data']]
                # check top and bottom (must be single line)
                max_y = max(y_data)
                all_index_max = [i for i, v in enumerate(y_data) if v == max_y]
                if len(all_index_max) == 1:
                    data_fact['top'] = all_index_max[0]
                min_y = min(y_data)
                all_index_min = [i for i, v in enumerate(y_data) if v == min_y]
                if len(all_index_min) == 1:
                    data_fact['bottom'] = all_index_min[0]
            data_facts.append(data_fact)
        time_end = time.time()
        print('time cost for data_facts: ', time_end - time_start)
        
        time_start = time.time()
        # 5. get topic relevant images
        # topic_images_query = search_image(meta['topic'])
        topic_images_query = {}
        # if need more images, search for meta['keywords']

        # 6. get chart relevant icons
        time_start = time.time()
        matcher = CLIPMatcher()  # 只创建一次CLIPMatcher实例
        icon_pools = []
        for i, chart in enumerate(res):
            json_file = os.path.join(json_path, '{}.json'.format(i))
            icon_pool = get_icon_pool(json_file, meta, matcher=matcher)  # 传入已创建的matcher实例
            icon_pools.append(icon_pool)
        time_end = time.time()
        print('time cost for get_icon_pool: ', time_end - time_start)

        # embed()

        # TODO how to save and return
        # df: total tabular data
        # chart: json data in json_path
        # meta: topic and caption (all share)
        # data_facts: trend, top, bottom
        # topic_images_query: images (all share)
        # icon_pools: icons
        result = {}
        result['meta_data'] = meta.copy()
        result['meta_data'].update(res[-1]['meta_data'])
        result['data'] = res[-1]['data']
        # print(len(result['data']))
        result['data_facts'] = data_facts
        # result['topic_images_urls'] = [v['original'] for v in topic_images_query['images_results'][:10]]
        # result['topic_images_query'] = topic_images_query
        result['icons'] = {}
        # result['icons']['topic'] = icon_pools[0]
        # result['icons']['x_label'] = icon_pools[1]
        # result['icons']['y_label'] = icon_pools[2]
        # result['icons']['x_data_single'] = icon_pools[3]
        # result['icons']['x_data_multi'] = icon_pools[3:]
        icon_semantic = icon_pools[-1]
        candidate_icons = icon_semantic.icon_pool
        topic_icon_pool = candidate_icons[0]
        x_label_icon_pool = candidate_icons[1]
        y_label_icon_pool = candidate_icons[2]
        x_data_single_icon_pool = candidate_icons[3]
        x_data_multi_icon_pool = candidate_icons[4:]
        icon_positions = icon_semantic.icon_positions
        icon_root = "/data1/liduan/generation/chart/iconset/colored_icons_new"
        result['icons']['topic'] = [os.path.join(icon_root, icon_positions[v][0], icon_positions[v][1]) for v in topic_icon_pool]
        result['icons']['x_label'] = [os.path.join(icon_root, icon_positions[v][0], icon_positions[v][1]) for v in x_label_icon_pool]
        result['icons']['y_label'] = [os.path.join(icon_root, icon_positions[v][0], icon_positions[v][1]) for v in y_label_icon_pool]
        result['icons']['x_data_single'] = [os.path.join(icon_root, icon_positions[v][0], icon_positions[v][1]) for v in x_data_single_icon_pool]
        result['icons']['x_data_multi'] = []
        for i, icon_pool in enumerate(x_data_multi_icon_pool):
            result['icons']['x_data_multi'].append([os.path.join(icon_root, icon_positions[v][0], icon_positions[v][1]) for v in icon_pool])
        
        return result
    
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
from .data_enricher_modules.icon_selection import get_icon_pool

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

        # 2. find potential chart and data
        json_path = os.path.join(cache_dir, 'json')
        shutil.rmtree(json_path, ignore_errors=True)
        os.makedirs(json_path)
        res, valid_chart_num = extract_chart(cache_path, json_path)

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
        # print(meta.keys())  # ['topic', 'keywords', 'title', 'caption']

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
        
        # 5. get topic relevant images
        topic_images_query = search_image(meta['topic'])
        # if need more images, search for meta['keywords']

        # 6. get chart relevant icons
        icon_pools = []
        for i, chart in enumerate(res):
            json_file = os.path.join(json_path, '{}.json'.format(i))
            icon_pool = get_icon_pool(json_file, meta)
            icon_pools.append(icon_pool)

        embed()

        # TODO how to save and return
        # df: total tabular data
        # chart: json data in json_path
        # meta: topic and caption (all share)
        # data_facts: trend, top, bottom
        # topic_images_query: images (all share)
        # icon_pools: icons
        pass
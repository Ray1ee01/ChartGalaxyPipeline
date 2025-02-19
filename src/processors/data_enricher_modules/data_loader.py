from abc import ABC, abstractmethod
from src.utils.dataset import VizNET
from typing import Any
import os
import json
import pandas as pd
import numpy as np
import re

# cache_dir = '/data1/liduan/generation/chart/chart_pipeline/src/cache'



def clean_df(df: pd.DataFrame) -> pd.DataFrame:
    # drop error data
    for column in df.columns:
        if df[column].isnull().all():
            df.drop(columns=[column], inplace=True)
    df = df.replace('', np.nan)
    df = df.dropna(axis=0, how='all')

    # drop duplicate columns
    columns_to_drop = []
    for i in range(len(df.columns)):
        for j in range(i + 1, len(df.columns)):
            col1 = df.columns[i]
            col2 = df.columns[j]
            if df[col1].equals(df[col2]) and col1 == col2:
                columns_to_drop.append(col2)

            elif col1 == col2 and not df[col1].equals(df[col2]):
                new_col_name = f"{col2}_d"
                k = 1
                while new_col_name in df.columns:
                    new_col_name = f"{col2}_d_{k}"
                    k += 1
                df.rename(columns={col2: new_col_name}, inplace=True)
    df.drop(columns=columns_to_drop, inplace=True)
    # rule base clean
    for column in df.columns:
        if df[column].apply(lambda x: bool(re.match(r"^\s*\$\s*[\d\'.]+$", str(x)))).all():
            df[column] = df[column].apply(lambda x: re.sub(r"\s*\$\s*", "", str(x)).strip()).str.replace("'", "")
            # df.rename(columns={column: f"{column}(USD)"}, inplace=True)
    # from IPython import embed; embed(); exit()
    return df

class DataLoader(ABC):
    @abstractmethod
    def load(self, data_id: str) -> Any:
        pass


class VizNetDataLoader(DataLoader):
    def load(self, data_id: str) -> Any:
        data_id = int(data_id)
        dataset_num = 100
        table_num = 100
        data_id = data_id % (dataset_num * table_num)
        dataset_id = data_id // table_num
        table_id = data_id % table_num
        dataset = VizNET()
        raw_data = dataset.get_object(dataset_id, table_id)
        table = raw_data['relation']
        table = np.array(table).T.tolist()
        columns = table[0]
        table = table[1:]
        df = pd.DataFrame(table, columns=columns)
        df = clean_df(df)
        # if not os.path.exists(cache_dir):
        #     os.makedirs(cache_dir)
        # cache_path = os.path.join(cache_dir, 'df.csv')
        # df.to_csv(cache_path, index=False)
        raw_meta_data = {}
        raw_meta_data['pageTitle'] = raw_data['pageTitle']
        raw_meta_data['title'] = raw_data['title']
        raw_meta_data['url'] = raw_data['url']
        raw_meta_data['textBeforeTable'] = raw_data['textBeforeTable']
        raw_meta_data['textAfterTable'] = raw_data['textAfterTable']
        
        return df, raw_meta_data



class Chart2TableDataLoader(DataLoader):
    def __init__(self):
        # self.root_dir = '/data1/liduan/generation/chart/chart_pipeline/src/data/chart_to_table'
        self.root_dir = "D:/VIS/Infographics/data/chart_pipeline/src/data/chart_to_table"

    def load(self, data_id: str) -> Any:
        data_type = data_id.split('_')[0]
        data_id = int(data_id.split('_')[1])
        dataset_dir = os.path.join(self.root_dir, data_type)
        id_map_path = os.path.join(dataset_dir, 'id_map.json')
        cur_id = 0
        if not os.path.exists(id_map_path):
            id_map = {}
            # 遍历dataset_dir下的所有文件
            for file in os.listdir(dataset_dir):
                if file.endswith('.csv'):
                    id_map[cur_id] = file
                    cur_id += 1
            with open(id_map_path, 'w') as f:
                json.dump(id_map, f)
                
        else:
            with open(id_map_path, 'r') as f:
                id_map = json.load(f)
        real_id = id_map[str(data_id)]
        meta_data_path = os.path.join(dataset_dir, 'metadata.json')
        with open(meta_data_path, 'r', encoding='utf-8') as f:
            loaded_meta_data = json.load(f)
        
        file_name = real_id.split('.')[0]
        data_table = pd.read_csv(os.path.join(dataset_dir, real_id))
        # print(data_table.head())
        
        
        raw_meta_data = {
            'title': loaded_meta_data[file_name]['title'],
        }
        
        return data_table, raw_meta_data
        
        
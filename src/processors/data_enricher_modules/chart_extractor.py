from abc import ABC, abstractmethod
from typing import Any
import os
import json
import pandas as pd
import numpy as np
import re
from .HAI_extract import extract_chart

class ChartExtractor(ABC):
    @abstractmethod
    def extract(self, df, item_range = (5, 20)):
        pass

def determine_column_type(df, column_name):
    column = df[column_name]
    
    # 检查是否为 None（所有值都是 NaN 或空）
    if column.isnull().all():
        return 'None'
    
    # 检查是否为 temporal（时间型数据）
    elif pd.api.types.is_datetime64_any_dtype(column):
        return 'temporal'
    
    # 检查是否为 numerical（数值型数据）
    elif pd.api.types.is_numeric_dtype(column):
        return 'numerical'
    
    # 检查是否为 categorical（类别型数据）
    elif pd.api.types.is_categorical_dtype(column) or column.dtype == 'object':
        return 'categorical'
    
    # 默认返回 None
    return 'None'

class HAIChartExtractor(ChartExtractor):
    def extract(self, df, item_range = (5, 20)):
        # try:
        chart_list, valid_chart_num = extract_chart(df, (7,8))
        # except:
        #     print('error in extract_chart')
        #     return
        chart_list[-1]['meta_data']['chart_type'] = 'bar'
        return chart_list[-1]['data'], chart_list[-1]['meta_data']

def avoid_np_type(data):
    if isinstance(data, (np.integer, np.floating, np.bool_)):
        return data.item()
    return data
class NaiveChartExtractor(ChartExtractor):
    def extract(self, df, item_range = [5, 10]):
        # 从df中随机筛选item_range个item
        item_num = len(df)
        # if item_num < item_range[0]:
        #     return None
        # 从[5, 20]的范围随机选择一个数字
        # min_num = item_range[0]
        # max_num = item_range[1]
        # selected_num = np.random.randint(min_num, max_num)
        
        # selected_num = 7
        # if selected_num > item_num:
        #     selected_num = item_num
        # item_idx = np.random.choice(item_num, selected_num, replace=False)
        
        # item_idx = np.random.choice(item_num, item_num, replace=False)
        item_idx = np.arange(item_num)
        meta_data = {
            'x_type': determine_column_type(df, df.columns[0]),
            'x_label': df.columns[0],
            'x_axis': df.columns[0],
            'y_type': determine_column_type(df, df.columns[1]),
            'y_label': df.columns[1],
            'y_axis': df.columns[1],
        }
        if 'group' in df.columns:
            meta_data['group_type'] = determine_column_type(df, df.columns[2])
            meta_data['group_label'] = df.columns[2]
            meta_data['group_axis'] = df.columns[2]
        if 'order' in df.columns: # For connected scatterplot
            meta_data['order_type'] = determine_column_type(df, df.columns[2])
            meta_data['order_label'] = df.columns[2]
            meta_data['order_axis'] = df.columns[2]
        if 'size' in df.columns: # For bubble chart
            meta_data['size_type'] = determine_column_type(df, df.columns[2])
            meta_data['size_label'] = df.columns[2]
            meta_data['size_axis'] = df.columns[2]
            
        filtered_df = df.iloc[item_idx]
        data = []
        for i in range(len(filtered_df)):
            data.append({
                'x_data': avoid_np_type(filtered_df.iloc[i][0]),
                'y_data': avoid_np_type(filtered_df.iloc[i][1]),
            })
            if 'group' in df.columns:
                data[-1]['group'] = avoid_np_type(filtered_df.iloc[i][2])
            if 'order' in df.columns:
                data[-1]['order'] = avoid_np_type(filtered_df.iloc[i][2])
            if 'size' in df.columns:
                data[-1]['size'] = avoid_np_type(filtered_df.iloc[i][2])
        for item in data:
            for key in item.keys():
                if isinstance(item[key], str):
                    item[key] = clean_str(item[key])
        for key in meta_data.keys():
            if isinstance(meta_data[key], str):
                meta_data[key] = clean_str(meta_data[key])
        return data, meta_data


def clean_str(s):
    # 删除字符串中所有不合法的字符
    # 合法字符：英文、数字、空格
    valid_chars = "1234567890-=qwertyuiop[]asdfghjkl;zxcvbnm,.ZXCVBNM<>?ASDFGHJKL:QWERTYUIOP|POIUYTREWQ "
    # return re.sub(r'[^\u0000-\u007F]+', '', s)
    return ''.join(char for char in s if char in valid_chars)
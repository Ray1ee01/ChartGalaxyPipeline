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
        print("df: ", df)
        # try:
        chart_list, valid_chart_num = extract_chart(df, item_range)
        # except:
        #     print('error in extract_chart')
        #     return
        chart_list[-1]['meta_data']['chart_type'] = 'bar'
        return chart_list[-1]['data'], chart_list[-1]['meta_data']

class NaiveChartExtractor(ChartExtractor):
    def extract(self, df, item_range = (5, 20)):
        # 从df中随机筛选item_range个item
        item_num = len(df)
        if item_num < item_range[0]:
            return None
        item_idx = np.random.choice(item_num, item_range[0], replace=False)
        meta_data = {
            'x_type': determine_column_type(df, df.columns[0]),
            'x_label': df.columns[0],
            'x_axis': df.columns[0],
            'y_type': determine_column_type(df, df.columns[1]),
            'y_label': df.columns[1],
            'y_axis': df.columns[1],
        }
        filtered_df = df.iloc[item_idx]
        data = []
        for i in range(len(filtered_df)):
            data.append({
                'x_data': filtered_df.iloc[i][0],
                'y_data': filtered_df.iloc[i][1],
            })
        return data, meta_data
from .HAIChart.extract import get_chart_from_df
import os

def package(x_type, x_label, y_type, y_label, data_x, data_y, source_file, chart_type, description, group_info = None):
    res = {}
    res['meta_data'] = {
        'x_type': x_type,
        'y_type': y_type,
        'x_label': x_label,
        'y_label': y_label,
        'x_axis': x_label,
        'y_axis': y_label,
        'source': source_file,
        'chart_type': chart_type,
        'description': description
    }
    if len(data_x) == 1:
        res['data'] = [{'x_data': d[0], 'y_data': d[1]} for d in zip(data_x[0], data_y[0])]
    elif group_info is None:
        res['data'] = [{'x_data': d[0], 'y_data': d[1], 'group':i} for i in range(len(data_x)) for d in zip(data_x[i], data_y[i])]
    else:
        res['data'] = [{'x_data': d[0], 'y_data': d[1], 'group':group_info[i]} for i in range(len(data_x)) for d in zip(data_x[i], data_y[i])]
    return res

import pandas as pd
type_list = ['None', 'categorical', 'numerical', 'temporal']

import json
import datetime
import random
import numpy as np
import re

def contains_letter(string_array):
    for string in string_array:
        if re.search(r'[a-zA-Z]', string):
            return True
    return False

norank_list = [('Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun'), ('Mon', 'Tue', 'Wed', 'Thur', 'Fri'), ('Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat')]

def extract_chart(df, item_range = (5, 20)):
    try:
        chart_list = get_chart_from_df(df)
    except:
        print('error in get_chart')
        return
    chart_idx = 0
    results = []
    for chart in chart_list:
        # final_pd = get_final_pd(df, chart)
        x_type = type_list[chart['view'].fx.type]
        y_type = type_list[chart['view'].fy.type]
        x_label = chart['view'].x_name
        y_label = chart['view'].y_name
        x_data = chart['view'].X
        y_data = chart['view'].Y
        chart_type = chart['chart']
        description = chart['describe']
        if type(x_data[0][0]) is datetime.date:
            x_data = [[d.strftime('%Y-%m-%d') for d in x] for x in x_data]
        if type(x_data[0][0]) is datetime.datetime:
            x_data = [[d.strftime('%Y-%m-%d %H:%M:%S') for d in x] for x in x_data]
        if type(x_data[0][0]) is pd.Timestamp:
            x_data = [[d.strftime('%Y-%m-%d') for d in x] for x in x_data]
        # if all x_data is '%Y-01-01', then change to '%Y'
        if all(isinstance(d, str) for d in x_data[0]) and \
            all(len(d.split('-')) == 3 for d in x_data[0]) \
                and all([all([d.split('-')[1] == '01' and d.split('-')[2] == '01' for d in x]) for x in x_data]):
            x_data = [[d.split('-')[0] for d in x] for x in x_data]
        
        rand_target = random.randint(item_range[0], item_range[1])
        target_num = min(len(x_data[0]), rand_target)
        x_data = [x_data[i][:target_num] for i in range(len(x_data))]
        y_data = [y_data[i][:target_num] for i in range(len(y_data))]
        if x_type == 'categorical' and len(x_data) == 1 and tuple(x_data[0]) not in norank_list and contains_letter(x_data[0]):
            # random: 1. decreasing 2. increasing 3. unchanged
            rand_type = random.randint(1, 3)
            if rand_type == 1:
                idx = np.argsort(y_data[0]).tolist()
                # from IPython import embed; embed(); exit()
                x_data_cp = [x_data[0][i] for i in idx]
                y_data_cp = [y_data[0][i] for i in idx]
                x_data = [x_data_cp]
                y_data = [y_data_cp]
            elif rand_type == 2:
                idx = np.argsort(y_data[0])[::-1].tolist()
                x_data_cp = [x_data[0][i] for i in idx]
                y_data_cp = [y_data[0][i] for i in idx]
                x_data = [x_data_cp]
                y_data = [y_data_cp]

        # add filter for y_data
        group_info = None
        if len(y_data) == 1: # no group
            if all([y_data[0][0] == y for y in y_data[0]]): # all same data
                continue    
            if sum([y == 0 for y in y_data[0]]) > len(y_data[0]) / 2: # more than 50% zero
                continue
        else: # group
            assert len(chart['view'].table.classes) == len(y_data)
            group_info = chart['view'].table.classes
            # from IPython import embed; embed(); exit()
            # continue

        res = package(x_type, x_label, y_type, y_label, x_data, y_data, "", chart_type, description, group_info)
        results.append(res)

        # path = os.path.join(target_path, '{}.json'.format(chart_idx))
            
        # try:
        #     with open(path, 'w') as f:
        #         json.dump(res, f)
        # except:
        #     from IPython import embed; embed();exit()
        chart_idx += 1
    
    return results, chart_idx
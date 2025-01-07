from datetime import datetime
import os
import random
import time
import json
import pandas as pd
from . import tools
from .mcgs import MCGS, Node
import networkx as nx
import matplotlib.pyplot as plt 

haichart = tools.haichart("mcgs")

def get_chart(file_path):
    # df = pd.read_csv(file_path)
    # df = df.dropna()
    # df.to_csv(file_path, index=False)

    haichart.from_csv(file_path)
    haichart.learning_to_rank()
    eh_view = haichart.output_list("list")

    keys = list(eh_view.keys())

    vega_zeros = []
    for key in keys:
        # find place of chart: 
        p1 = key.find("chart: ")
        p2 = key.find(" x_name: ")
        p3 = key.find(" y_name: ")
        p4 = key.find(" describe: ")
        chart = key[p1+7:p2]
        x_name = key[p2+9:p3]
        y_name = key[p3+9:p4]
        describe = key[p4+11:]
        res = {"chart": chart, "x_name": x_name, "y_name": y_name, "describe": describe, "group_by": [], "bin": [], "view": eh_view[key]}
        
        # 从describe中提取group by A和bin A by B，可能有多个group by
        each = describe.split(", ")
        for e in each:
            if e.startswith("group by"):
                p = e.find("group by ")
                group_by = e[p+9:]
                res["group_by"].append(group_by)
            elif e.startswith("bin"):
                p = e.find("bin ")
                p2 = e.find(" by ")
                bin_name = e[p+4:p2]
                bin_by = e[p2+4:]
                res["bin"].append(bin_name)
        vega_zeros.append(res)
    # from pprint import pprint
    # pprint(vega_zeros)

    # dict_sorted = haichart.eh_view.items()
    return vega_zeros

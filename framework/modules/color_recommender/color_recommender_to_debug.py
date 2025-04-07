#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
颜色推荐模块 (color_recommender)
基于输入数据特征，自动推荐颜色
"""

import json
import logging
import argparse
from typing import Dict, List, Any, Tuple
from color_framework import ColorFramework
from color_template import ColorDesign

# 配置日志
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def process(input: str, output: str) -> bool:
    """
    处理输入数据并生成颜色推荐
    
    Args:
        input: 输入JSON文件路径
        output: 输出JSON文件路径
        
    Returns:
        处理成功返回True，否则返回False
    """
    try:
        # 读取输入数据
        logger.info(f"读取输入文件: {input}")
        with open(input, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # 抽取需要使用的数据条目
        # logger.info("抽取颜色需要使用的数据条目")
        assert "metadata" in data, "数据格式错误，缺少'metadata'字段"
        assert "data" in data or "columns" not in data["data"], "数据格式错误，缺少'data.columns'字段"
        assert "datafacts" in data, "数据格式错误，缺少'datafacts'字段"
        data_info = {
            "title": data["metadata"]["title"],
            "description": data["metadata"]["description"],
            "main_insight": data["metadata"]["main_insight"],
            "columns": data["data"]["columns"],
            "data_facts": data["datafacts"]
        }
        
        # 生成颜色模式推荐
        # logger.info("生成颜色模式推荐")
        colorframework = ColorFramework(data_info)
        schemes = colorframework.load_scheme_list()
        logger.info(f"获取颜色模式共{len(schemes)}种, 依次为: {schemes}")
        
        # 默认选择第一种模式配置调色盘
        # TODO: 【存在多种可选模式】选择最合适的颜色模式，或者增加随机性得到不同的颜色模式
        palette = colorframework.get_infographic_palette(0)
        logger.info(f"默认选择第一种模式配置调色盘: {palette}")

        # 生成颜色模版，根据颜色模版配置颜色
        color_design = ColorDesign(palette, lighter="high") # lighter: "high","low"
        res = {}
        if len(palette["main_color"]) == 1: # 仅有一个主色
            res["other"] = {
                "primary": color_design.main_color_hex[0],
            }
        elif len(palette["main_color"]) == 2: # 有两个主色
            res["other"] = {
                "primary": color_design.main_color_hex[0],
                "secondary": color_design.main_color_hex[1],
            }
        else:
            res["other"] = {}

        use_group = False
        group_col = None
        x_col = None
        for column in data_info["columns"]:
            if column["role"] == "group":
                use_group = True
                group_col = column["name"]
            if column["role"] == "x":
                x_col = column["name"]
        # TODO：【存在多种可选颜色参数】选择最合适的颜色参数，或者增加随机性得到不同的颜色模版，例如以下给出的各种seed
        # get_color: seed_mark（mark颜色模式）seed_text（文本颜色模式）
        #            seed_color（gourp时不同颜色模式）, seed_context_color（不同的上下文颜色）, seed_middle_color （不同的其他中间色）

        if not use_group:
            unique_x_values = list(set(item[x_col] for item in data["data"]))
            print("unique_x_values: ", unique_x_values)
            mark_colors = color_design.get_color("marks", len(unique_x_values), group=1, seed_mark=0) 
            color_list = mark_colors["group1"]
            # TODO: 【根据语义等其他特征调整颜色分配】目前直接assign
            color_assign = {}
            for i, item in enumerate(unique_x_values):
                color_assign[item] = color_list[i]
            res["field"] = color_assign
        else:
            groups = {}
            group_idx = 0
            group_list = []
            data_group = []
            for item in data["data"]:
                if item[group_col] not in groups:
                    groups[item[group_col]] = group_idx
                    group_idx += 1
                    group_list.append(item[group_col])
                    data_group.append([])
                data_group[groups[item[group_col]]].append(item)
            # TODO: 目前要求每个group下的data数量一样，后续可以考虑不一样的情况
            assert len(set([len(d) for d in data_group])) == 1, "每个group下的data数量不一样"
            mark_colors = color_design.get_color("marks", len(data_group[0]), group=len(data_group), seed_mark=1)
            # TODO: 【根据语义等其他特征调整颜色分配】目前根据每个group直接assign
            color_assign = {}
            for i, group in enumerate(data_group):
                color_list = mark_colors[f"group{i+1}"]
                for j, item in enumerate(group):
                    color_assign[item[x_col]] = color_list[j]
            res["field"] = color_assign

        res["background_color"] = color_design.get_color("background")[0]
        text_colors = color_design.get_color("text", seed_text=1)
        res["text_color"] = text_colors["annotation"][0]
        res["title_color"] = text_colors["title"]
        res["caption_color"] = text_colors["caption"]

        used_colors = []
        for key in res["field"]:
            used_colors.append(res["field"][key])
        used_colors.append(res["background_color"])
        used_colors.append(res["text_color"])
        res["available_colors"] = color_design.get_emphasis_colors(used_colors) 
        # TODO: 【available颜色计算】目前仅考虑了颜色距离，可以进一步筛选可用的其他颜色

        # TODO: 【考虑data fact增加可以使用的颜色】
        data["color"] = res
        
        # 写入输出文件
        logger.info(f"写入输出文件: {output}")
        with open(output, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        logger.info("颜色推荐完成")
        return True
        
    except Exception as e:
        logger.error(f"处理失败: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ChartPipeline - 颜色推荐模块")
    parser.add_argument("--input", required=True, help="输入JSON文件路径")
    parser.add_argument("--output", required=True, help="输出JSON文件路径")
    
    args = parser.parse_args()
    
    process(input=args.input, output=args.output) 
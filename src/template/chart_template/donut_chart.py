from typing import Optional, Dict, Any
from .base import ChartTemplate, LayoutConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate, ColorTemplate, StrokeTemplate
from ..color_template import ColorDesign
from ..mark_template.pie import PieTemplate
import pandas as pd

class DonutChartTemplate(ChartTemplate):
    def __init__(self, color_template: ColorDesign = None):
        super().__init__(color_template)
        self.chart_type = "donut"
        self.theta: Optional[Dict[str, Any]] = None
        self.color: Optional[Dict[str, Any]] = None
        self.x_axis: Optional[AxisTemplate] = None # 占位
        self.y_axis: Optional[AxisTemplate] = None # 占位
        self.color_encoding: Optional[ColorEncodingTemplate] = None

    def update_specification(self, specification):
        return specification

    def create_template(self, data: list, meta_data: dict, color_template: ColorDesign = None, config: dict = None):
        """
        创建甜甜圈图模板的核心方法
        """
        # 验证必要的字段
        value_field = meta_data.get('y_label')
        category_field = meta_data.get('x_label')
        
        if not value_field or not category_field:
            raise ValueError("Both value_field and category_field are required for pie chart")

        # 设置theta编码
        self.theta={
            "field": value_field,
            "type": "quantitative"
        }

        # 设置color编码
        self.color={
            "field": category_field,
            "type": "nominal"
        }

        mark_config = config.get('mark', {}).get('arc', {})
        self.mark = PieTemplate(color_template, mark_config)
        self.color_encoding = ColorEncodingTemplate(color_template, meta_data, data)
        single_color_flag = self.color_encoding.encoding_data("x_label")
        if single_color_flag:
            self.mark.color = self.color_encoding.range[0]
            self.color_encoding = None

    def update_specification(self, specification: dict):
        specification['encoding']['theta'] = self.theta
        specification['encoding']['color'] = self.color
        return specification

    def dump(self):
        return {
            "mark": self.mark.dump(),
            "theta": self.theta,
            "color": self.color
        }

class SemiCircleDonutChartTemplate(DonutChartTemplate):
    def __init__(self, color_template: ColorDesign = None):
        super().__init__(color_template)
        self.chart_type = "semicircledonut"

    def create_template(self, data: list, meta_data: dict, color_template: ColorDesign = None, config: dict = None):
        super().create_template(data, meta_data, color_template, config)

    def dump(self):
        return {
            "mark": self.mark.dump(),
            "theta": self.theta,
            "color": self.color,
        }
    
    def update_option(self, echart_option: dict) -> None:
        """更新半环形图配置选项"""
        self.echart_option = echart_option
        
        # 获取数据并转换为DataFrame
        data = echart_option["dataset"]["source"]
        # print("data为")
        # print(data)
        df = pd.DataFrame(data[1:], columns=data[0])
        # print("df为")
        # print(df)
        
        # 获取x轴数据
        x_list = df['x_data'].tolist()
        
        # 配置系列
        self.echart_option["series"][0].update({
            "type": "pie",
            "radius": [f"\"{self.mark.innerRadius}%\"", f"\"{self.mark.radius}%\""],  # 设置内外半径
            "center": ["50%", "70%"],  # 设置圆心位置
            "avoidLabelOverlap": True,
            "itemStyle": {
                "borderRadius": 4,
                "borderWidth": 2,
                "borderColor": "#fff"
            },
            "label": {
                "show": True,
                "formatter": "{b}:\n{d}%"  # 显示名称和百分比
            },
            "emphasis": {
                "itemStyle": {
                    "shadowBlur": 10,
                    "shadowOffsetX": 0,
                    "shadowColor": "rgba(0, 0, 0, 0.5)"
                }
            },
            "startAngle": 180,  # 起始角度
            "endAngle": 0,  # 结束角度
            "data": [
                {
                    "name": name,
                    "value": int(df.loc[df["x_data"] == name, "y_data"].sum())
                } for name in x_list
            ]
        })
        
        # 配置提示框
        self.echart_option["tooltip"] = {
            "trigger": "item",
            "formatter": "{b}: {c} ({d}%)"
        }
        
        return self.echart_option
    
class MultiLevelDonutChartTemplate(DonutChartTemplate):
    def __init__(self, color_template: ColorDesign = None):
        super().__init__(color_template)
        self.chart_type = "multi_level_donut"

    def create_template(self, data: list, meta_data: dict, color_template: ColorDesign = None):
        """
        创建多层甜甜圈图模板的核心方法
        """
        super().create_template(data, meta_data, color_template)
        

    def dump(self):
        return {
            "mark": self.mark.dump(),
            "theta": self.theta,
            "color": self.color
        }
    
    def update_option(self, echart_option: dict) -> None:
        """更新多圈甜甜圈图配置选项"""
        self.echart_option = echart_option
        
        # 获取数据并转换为DataFrame
        data = echart_option["dataset"]["source"]
        # print("data为")
        # print(data)
        df = pd.DataFrame(data[1:], columns=data[0])
        # print("df为")
        # print(df)
        # 按group列排序DataFrame
        df = df.sort_values(by='group')
        # 获取数据
        x_list = df['x_data'].tolist()
        y_list = df['y_data'].tolist()
        group_list = df['group'].unique().tolist()
          
        # 配置系列
        middle = (self.mark.innerRadius + self.mark.radius) / 2
        self.echart_option["series"] = []
        self.echart_option["series"].append({})
        self.echart_option["series"].append({})
        self.echart_option["series"][0].update({
            "type": "pie",
            "radius": [f"\"{self.mark.innerRadius}%\"", f"\"{middle}%\""],  # 设置内外半径
            "center": ["50%", "50%"],  # 设置圆心位置
            "avoidLabelOverlap": True,
            "itemStyle": {
                "borderRadius": 4,
                "borderWidth": 2,
                "borderColor": "#fff"
            },
            "label": {
                "show": True,
                "formatter": "{b}:\n{d}%",  # 显示名称和百分比
                "position": "inside"
            },
            "emphasis": {
                "itemStyle": {
                    "shadowBlur": 10,
                    "shadowOffsetX": 0,
                    "shadowColor": "rgba(0, 0, 0, 0.5)"
                }
            },
            "data": [
                {
                    "name": name,
                    "value": float(df.loc[df["group"] == name, "x_data"].sum())
                } for name in group_list
            ]
        })

        self.echart_option["series"][1].update({
            "type": "pie",
            "radius": [f"\"{middle}%\"", f"\"{self.mark.radius}%\""],  # 设置内外半径
            "center": ["50%", "50%"],  # 设置圆心位置
            "avoidLabelOverlap": True,
            "itemStyle": {
                "borderRadius": 4,
                "borderWidth": 2,
                "borderColor": "#fff"
            },
            "label": {
                "show": True,
                "formatter": "{b}:\n{d}%"  # 显示名称和百分比
            },
            "emphasis": {
                "itemStyle": {
                    "shadowBlur": 10,
                    "shadowOffsetX": 0,
                    "shadowColor": "rgba(0, 0, 0, 0.5)"
                }
            },
            "data": [
                {
                    "name": name,
                    "value": float(df.loc[df["y_data"] == name, "x_data"].sum())
                } for name in y_list
            ]
        })
        
        # 配置提示框
        self.echart_option["tooltip"] = {
            "trigger": "item",
            "formatter": "{b}: {c} ({d}%)"
        }
        
        return self.echart_option
from .base import ChartTemplate, LayoutConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate, ShapeEncodingTemplate, ColorTemplate, StrokeTemplate
from ..mark_template.point import PointTemplate
from ..color_template import ColorDesign
import pandas as pd
import copy

class ScatterPlotTemplate(ChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "scatterplot"
        self.sort = None
    
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        self.x_axis = AxisTemplate(color_template)
        # self.x_axis.field_type = "quantitative"
        self.x_axis.field_type = None
        self.x_axis.field = meta_data['x_label']

        self.y_axis = self.x_axis.copy()
        # self.y_axis.field_type = "quantitative"
        self.y_axis.field_type = None
        self.y_axis.field = meta_data['y_label']
        
        self.mark = PointTemplate(color_template)
        
        self.color_encoding = ColorEncodingTemplate(color_template, meta_data, data)
        single_color_flag = self.color_encoding.encoding_data("group_label")
        if single_color_flag:
            self.mark.color = self.color_encoding.range[0]
        
        self.shape_encoding = ShapeEncodingTemplate(meta_data, data)
        
        if meta_data is None:
            # set default value
            self.x_axis.field = "category"
            self.x_axis.field_type = "nominal"
            
            self.y_axis.field = "value"
            self.y_axis.field_type = "quantitative"
        else:
            if meta_data['x_type'] == "categorical":
                meta_data['x_type'] = "nominal"
            elif meta_data['x_type'] == "numerical":
                meta_data['x_type'] = "quantitative"
            if meta_data['y_type'] == "categorical":
                meta_data['y_type'] = "nominal"
            elif meta_data['y_type'] == "numerical":
                meta_data['y_type'] = "quantitative"
            
            if isinstance(data[0]['x_data'], str):
                meta_data['x_type'] = "temporal"
            else:
                meta_data['x_type'] = "quantitative"
                
            self.x_axis.field = meta_data['x_label']
            self.x_axis.field_type = meta_data['x_type']
                
            self.y_axis.field = meta_data['y_label']
            self.y_axis.field_type = meta_data['y_type']
    
    
    def update_specification(self, specification: dict) -> None:
        if hasattr(self, 'shape_encoding') and self.shape_encoding:
            shape_encoding = {
                "field": self.shape_encoding.field,
                "type": self.shape_encoding.field_type,
                "scale": {
                    "domain": self.shape_encoding.domain,
                    "range": self.shape_encoding.range
                }
            }
            specification["encoding"]["shape"] = shape_encoding
        return specification
    
    def dump(self):
        result = {
            "x_axis": self.x_axis.dump(),
            "y_axis": self.y_axis.dump(),
            "mark": self.mark.dump(),
            "color_encoding": self.color_encoding.dump()
        }
        if self.shape_encoding is not None:
            result["shape_encoding"] = self.shape_encoding.dump()
        # 添加排序配置到输出
        if self.sort is not None:
            result["sort"] = self.sort
            
        return result
    
class ScatterPlotConstraint(LayoutConstraint):
    """散点图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, ScatterPlotTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "vertical"
        chart_template.x_axis.orientation = "bottom"
        chart_template.x_axis.field_type = "quantitative"
        chart_template.y_axis.orientation = "left"
        chart_template.y_axis.field_type = "quantitative"

class ProportionalAreaTemplate(ScatterPlotTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "propotionalarea"

    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        super().create_template(data, meta_data, color_template)
        # TODO 设置轴
        self.x_axis = AxisTemplate(color_template)
        self.y_axis = AxisTemplate(color_template)

    def update_specification(self, specification: dict) -> None:
        # for Vega-Lite
        pass

    def update_option(self, echart_option: dict) -> None:
        self.echart_option = echart_option
        data = echart_option["dataset"]["source"]
        df = pd.DataFrame(data[1:], columns=data[0])

        x_data = self.x_axis.field or "x_data"
        y_data = self.y_axis.field or "y_data"
        group = "group"

        color_encoding = self.color_encoding.dump()
        self.echart_option["colorBy"] = "series"
        self.echart_option["color"] = color_encoding["range"]

        if "series" not in echart_option or not echart_option["series"]:
            user_series = {}
        else:
            user_series = echart_option["series"][0]

        domain = color_encoding["domain"]
        group_num = len(domain)

        new_series_list = []
        new_titles_list = []
        new_singleAxis_list = []

        def wrap_text_in_lines(text: str, width: int = 8) -> str:
            lines = []
            for i in range(0, len(text), width):
                lines.append(text[i : i + width])
            return "\n".join(lines)

        for idx, name in enumerate(domain):
            sub_df = df[df[group] == name].copy()
            min_val = sub_df[y_data].min()
            max_val = sub_df[y_data].max()
            mean_val = sub_df[y_data].mean()

            axis_data = sub_df[x_data].unique().tolist()
            axis_data_wrapped = []
            for item in axis_data:
                item_str = str(item)
                item_wrapped = wrap_text_in_lines(item_str, 8)
                axis_data_wrapped.append(item_wrapped)

            series_item = copy.deepcopy(user_series)

            wrapped_name = wrap_text_in_lines(str(name), 8)

            title_item = {
                "textBaseline": "middle",
                "top": f"{(idx + 0.5) / group_num * 100}%",
                "text": wrapped_name
            }

            singleAxis_item = {
                "left": 150,
                "right": 80,
                "type": "category",
                "boundaryGap": False,
                "data": axis_data_wrapped,
                "top": f"{(idx * 100 - 5) / group_num}%",
                "height": f"{100 / group_num - 10}%",
                "axisLine": {"show": False},
                "axisLabel": {
                    "fontSize": 15,
                    "interval": 0,
                },
            }

            series_item.update({
                "singleAxisIndex": idx,
                "coordinateSystem": "singleAxis",
                "type": "scatter",
                "data": []
            })

            max_symbolSize = min(120, 600/len(sub_df)) if len(sub_df) > 0 else 20
            min_symbolSize = 0.2 * max_symbolSize
            mean_symbolSize = 0.5 * (max_symbolSize + min_symbolSize)
            diff_symbolSize = max_symbolSize - mean_symbolSize

            for jdx in range(len(sub_df)):
                row = sub_df.iloc[jdx]
                val_x = wrap_text_in_lines(row[x_data])
                val_y = float(row[y_data])

                if max_val == min_val:
                    sz = mean_symbolSize
                else:
                    if val_y == mean_val:
                        sz = mean_symbolSize
                    elif val_y > mean_val and max_val != mean_val:
                        ratio = (val_y - mean_val) / (max_val - mean_val)
                        sz = mean_symbolSize + ratio * diff_symbolSize
                    elif val_y < mean_val and min_val != mean_val:
                        ratio = (mean_val - val_y) / (mean_val - min_val)
                        sz = mean_symbolSize - ratio * diff_symbolSize
                    else:
                        if val_y > mean_val:
                            sz = max_symbolSize
                        else:
                            sz = min_symbolSize

                series_item["data"].append({
                    "value": [val_x, val_y],
                    "symbolSize": sz
                })

            new_series_list.append(series_item)
            new_titles_list.append(title_item)
            new_singleAxis_list.append(singleAxis_item)

        echart_option["title"] = new_titles_list
        echart_option["singleAxis"] = new_singleAxis_list
        echart_option["series"] = new_series_list

        return echart_option
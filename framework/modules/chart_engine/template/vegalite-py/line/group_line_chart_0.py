from .group_line_chart import GroupLineChart
from typing import Dict

"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Group Line Chart",
    "chart_name": "group_line_chart_0",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal","numerical"], ["numerical"], ["categorical"]],
    "required_other_colors": [],
    "supported_effects": [],
    "required_data_points": [5, 100],
    "required_image": [],
    "width": [500, 1000],
    "height": [500, 800],
    "x_range": [2, 20]
}
REQUIREMENTS_END
"""

class GroupLineChart0(GroupLineChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        mark_spec['strokeWidth'] = 3
        return mark_spec
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
 
        x_encoding_spec['axis']['domainOpacity'] = 0
        x_encoding_spec['axis']['tickOpacity'] = 0
        x_encoding_spec['axis']['labels'] = True
        x_encoding_spec['axis']['grid'] = False

        y_encoding_spec['axis']['domainOpacity'] = 0
        y_encoding_spec['axis']['tickOpacity'] = 0
        y_encoding_spec['axis']['labels'] = True
        y_encoding_spec['axis']['grid'] = True
        
        x_encoding_spec['type'] = 'quantitative'
        y_encoding_spec['type'] = 'quantitative'
        
        return x_encoding_spec, y_encoding_spec
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        return super().make_color_specification(json_data)
    
    def adjust_legend_position(self):
        pass
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        annotation_encoding_spec = self.make_annotation_specification(json_data)
        # 为了添加annotation，需要修改specification
        old_encoding = specification['encoding']
        
        annotation_encoding_spec[0]['encoding']['color'] = old_encoding['color']
        annotation_encoding_spec[0]['encoding']['x']['type'] = 'quantitative'
        annotation_encoding_spec[0]['encoding']['y']['type'] = 'quantitative'
        
        annotation_encoding_spec[1]['encoding']['color'] = old_encoding['color']
        annotation_encoding_spec[1]['encoding']['x']['type'] = 'quantitative'
        annotation_encoding_spec[1]['encoding']['y']['type'] = 'quantitative'
        print("old_encoding", old_encoding)
        old_mark = specification['mark']
        specification["layer"] = [
            {
                "mark": old_mark,
                "encoding": old_encoding
            },
            annotation_encoding_spec[0],
            annotation_encoding_spec[1]
        ]
        # 从specification中删除encoding和mark
        del specification['encoding']
        del specification['mark']
        return specification
    
    def make_annotation_specification_right(self, json_data: Dict) -> Dict:
        data_columns = json_data['data']['columns']
        x_column = None
        y_column = None
        group_column = None
        for column in data_columns:
            if column['role'] == 'x':
                x_column = column
            elif column['role'] == 'y':
                y_column = column
            elif column['role'] == 'group':
                group_column = column
        annotation_encoding_spec = {
            "mark": {"type": "text", "align": "left", "dx": 4},
            "encoding": {
                "text": {
                    "aggregate": {
                        "argmax": x_column['name']
                    },
                    "field": y_column['name']
                },
                "x": {
                    "aggregate": "max",
                    "field": x_column['name']
                },
                "y": {
                    "aggregate": {
                        "argmax": x_column['name']
                    },
                    "field": y_column['name']
                }
            }
        }
        return annotation_encoding_spec
    
    def make_annotation_specification_left(self, json_data: Dict) -> Dict:
        data_columns = json_data['data']['columns']
        x_column = None
        y_column = None
        group_column = None
        for column in data_columns:
            if column['role'] == 'x':
                x_column = column
            elif column['role'] == 'y':
                y_column = column
            elif column['role'] == 'group':
                group_column = column
        annotation_encoding_spec = {
            "mark": {"type": "text", "align": "right", "dx": -4},
            "encoding": {
                "text": {
                    "aggregate": {
                        "argmin": x_column['name']
                    },
                    "field": y_column['name']
                },
                "x": {
                    "aggregate": "min",
                    "field": x_column['name']
                },
                "y": {
                    "aggregate": {
                        "argmin": x_column['name']
                    },
                    "field": y_column['name']
                }
            }
        }
        return annotation_encoding_spec
    
    def make_annotation_specification(self, json_data: Dict) -> Dict:
        return [
            self.make_annotation_specification_right(json_data),
            self.make_annotation_specification_left(json_data)
        ]
        
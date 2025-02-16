from abc import ABC, abstractmethod

from ..style_template.base import ColorTemplate, StrokeTemplate, LabelFontTemplate
from ..mark_template.base import MarkTemplate

class ChartTemplate(ABC):
    def __init__(self, template_path: str=None):
        self.chart_type = None
        self.has_annotation = False
        self.height = 800
        self.width = 400
        self.step = 40
    
    def update_specification(self, specification: dict) -> None:
        """更新规范"""
        pass

class LayoutConstraint(ABC):
    """布局约束基类"""
    @abstractmethod
    def validate(self, chart_template: ChartTemplate) -> bool:
        raise NotImplementedError
    
    @abstractmethod
    def apply(self, chart_template: ChartTemplate) -> None:
        raise NotImplementedError
    
class SortConstraint(LayoutConstraint):
    """排序约束"""
    def __init__(self, sort_by: str = "y", ascending: bool = True):
        if sort_by not in ["x", "y"]:
            raise ValueError("sort_by 必须是 'x' 或 'y'")
        self.sort_by = sort_by
        self.ascending = ascending
    
    def validate(self, chart_template: ChartTemplate) -> bool:
        return True
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        
        chart_template.sort = {
            "by": self.sort_by,
            "ascending": self.ascending
        }
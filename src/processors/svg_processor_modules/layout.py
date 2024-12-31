from abc import ABC, abstractmethod
from typing import List
from .elements import LayoutElement, GroupElement

class LayoutStrategy(ABC):
    """布局策略基类"""
    @abstractmethod
    def layout(self, elements: List[LayoutElement]) -> None:
        pass

class VerticalLayoutStrategy(LayoutStrategy):
    """垂直布局策略"""
    def __init__(self, padding: float = 0):
        self.padding = padding
        
    def layout(self, elements: List[LayoutElement]) -> None:
        current_y = 0
        for element in elements:
            if element.bounding_box:
                element.bounding_box.miny = current_y
                element.bounding_box.maxy = current_y + element.bounding_box.height
                current_y += element.bounding_box.height + self.padding

class HorizontalLayoutStrategy(LayoutStrategy):
    """水平布局策略"""
    def __init__(self, padding: float = 0):
        self.padding = padding
        
    def layout(self, elements: List[LayoutElement]) -> None:
        current_x = 0
        for element in elements:
            if element.bounding_box:
                element.bounding_box.minx = current_x
                element.bounding_box.maxx = current_x + element.bounding_box.width
                current_x += element.bounding_box.width + self.padding
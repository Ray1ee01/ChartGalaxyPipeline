from abc import ABC, abstractmethod
from typing import Any, Dict, List
from ..template.template import ChartTemplate

class DataProcessor(ABC):
    @abstractmethod
    def process(self, raw_data: Any, layout_sequence: List[str]=[], chart_image_sequence: List[str]=[]) -> List[Dict]:
        pass

class ChartGenerator(ABC):
    @abstractmethod
    def generate(self, data: List[Dict], template: ChartTemplate=None) -> str:
        pass

class SVGProcessor(ABC):
    @abstractmethod
    def process(self, svg: str) -> str:
        pass